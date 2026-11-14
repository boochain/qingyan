import { answerLabel } from "./grade";
import { canonicalChosen, frameFromUnknown, summarizeExplain, type ItemFrame } from "./frame";
import type { Bank, Chapter, Library, Paper, QType, Question } from "./types";

export interface OpResult {
  index: number;
  op: string;
  ok: boolean;
  message: string;
  id?: string;
}

const TYPES = new Set<QType>(["single", "multi", "judge", "blank", "short", "frame"]);

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function asRecord(value: unknown, label = "操作"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}必须是对象`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`缺少${field}`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function opName(raw: unknown): string {
  if (raw && typeof raw === "object" && "op" in raw && typeof raw.op === "string") return raw.op;
  return "unknown";
}

function findBank(lib: Library, ref: string): Bank | undefined {
  const needle = ref.trim();
  return lib.banks.find((bank) => bank.id === needle || bank.name === needle);
}

function requireBank(lib: Library, ref: unknown): Bank {
  const name = text(ref, "题库");
  const bank = findBank(lib, name);
  if (!bank) throw new Error(`找不到题库「${name}」`);
  return bank;
}

function ensureBank(lib: Library, ref: unknown, at: string): Bank {
  const name = text(ref, "题库");
  const found = findBank(lib, name);
  if (found) return found;
  const bank: Bank = {
    id: uid("bank"),
    name,
    subject: "未分类",
    description: "",
    createdAt: at,
    updatedAt: at,
  };
  lib.banks.push(bank);
  return bank;
}

function tagsOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof value === "string") {
    return value
      .split(/[,，、|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

function difficultyOf(value: unknown): 1 | 2 | 3 {
  if (value == null || value === "") return 2;
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}

function letterTokens(list: string[]): string[] {
  return list.flatMap((item) => {
    const token = item.trim().replace(/[.、．)]$/u, "");
    if (/^[A-Ha-h]{2,8}$/.test(token)) return token.split("");
    if (/^[A-Ha-h](?:\s+[A-Ha-h]){1,7}$/.test(token)) return token.split(/\s+/);
    return [token || item.trim()];
  });
}

function inferType(rawType: unknown, rawChoices: unknown, rawAnswer: unknown): QType {
  const label = String(rawType ?? "").trim().toLowerCase();
  const map: Record<string, QType> = {
    single: "single",
    单选: "single",
    单选题: "single",
    multi: "multi",
    多选: "multi",
    多选题: "multi",
    judge: "judge",
    判断: "judge",
    判断题: "judge",
    blank: "blank",
    填空: "blank",
    填空题: "blank",
    short: "short",
    简答: "short",
    简答题: "short",
    frame: "frame",
    框架: "frame",
    框架题: "frame",
  };
  if (label && map[label]) return map[label];
  if (label && TYPES.has(label as QType)) return label as QType;
  const choiceCount = Array.isArray(rawChoices) ? rawChoices.filter((item) => String(item ?? "").trim()).length : 0;
  const answerText = Array.isArray(rawAnswer) ? rawAnswer.join(",") : String(rawAnswer ?? "");
  if (/^(对|错|正确|错误|true|false|yes|no|√|×)$/i.test(answerText.trim()) && choiceCount === 0) return "judge";
  if (choiceCount === 0) return answerText.length > 12 ? "short" : "blank";
  const parts = letterTokens(answerList(rawAnswer));
  return parts.length > 1 ? "multi" : "single";
}

function normalizeChoices(type: QType, raw: unknown): { id: string; text: string }[] {
  if (type === "judge") {
    return [
      { id: "T", text: "正确" },
      { id: "F", text: "错误" },
    ];
  }
  if (type === "blank" || type === "short") return [];
  if (!Array.isArray(raw) || raw.length < 2) throw new Error("选择题至少要两个选项");
  return raw.slice(0, 8).map((item, index) => {
    const id = String.fromCharCode(97 + index);
    if (typeof item === "string") {
      const text = item.replace(/^[A-Ha-h][.、．)\s]+/, "").trim();
      if (!text) throw new Error("选项要按 A、B、C 连续填写，中间不能留空");
      return { id, text };
    }
    const record = asRecord(item, "选项");
    return {
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : id,
      text: text(record.text, "选项内容"),
    };
  });
}

function answerList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  if (typeof raw === "number") return [String(raw)];
  if (typeof raw !== "string") return [];
  return raw
    .split(/[,，、|/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAnswer(type: QType, raw: unknown, choices: { id: string; text: string }[]): string[] {
  const list = type === "single" || type === "multi" ? letterTokens(answerList(raw)) : answerList(raw);
  if (!list.length) throw new Error("缺少答案");
  if (type === "judge") {
    const value = list[0]!.toLowerCase().replace(/[.、．)]$/u, "");
    if (["t", "true", "对", "正确", "是", "√", "y", "yes"].includes(value)) return ["T"];
    if (["f", "false", "错", "错误", "否", "×", "n", "no"].includes(value)) return ["F"];
    throw new Error("判断题答案用 对 或 错");
  }
  if (type === "blank" || type === "short") return list.slice(0, 8);
  const mapped = list.map((item) => {
    const letter = item.trim().toLowerCase();
    if (/^[a-h]$/.test(letter)) {
      const choice = choices[letter.charCodeAt(0) - 97];
      if (!choice) throw new Error(`没有选项 ${item}`);
      return choice.id;
    }
    const byId = choices.find((choice) => choice.id === item);
    if (byId) return byId.id;
    const byText = choices.find((choice) => choice.text === item);
    if (byText) return byText.id;
    throw new Error(`无法识别答案「${item}」`);
  });
  const unique = [...new Set(mapped)];
  if (type === "single" && unique.length !== 1) throw new Error("单选题只能有一个答案");
  return unique;
}

function touch(lib: Library, bankId: string, at: string) {
  const bank = lib.banks.find((item) => item.id === bankId);
  if (bank) bank.updatedAt = at;
}

function ensureChapter(lib: Library, bank: Bank, name: string): Chapter {
  const existing = lib.chapters.find((chapter) => chapter.bankId === bank.id && chapter.name === name);
  if (existing) return existing;
  const order = lib.chapters.filter((chapter) => chapter.bankId === bank.id).length;
  const chapter: Chapter = { id: uid("ch"), bankId: bank.id, name, order };
  lib.chapters.push(chapter);
  return chapter;
}

function readFrame(raw: Record<string, unknown>): ItemFrame | undefined {
  if (!("frame" in raw) || raw.frame == null || raw.frame === "") return undefined;
  const frame = frameFromUnknown(raw.frame);
  if (typeof raw.type === "string") {
    const label = raw.type.trim();
    if (label && !["frame", "框架", "框架题", "single", "multi", "judge", "blank", "short"].includes(label)) {
      frame.typeName = label;
    }
  }
  return frame;
}

function upsertQuestion(lib: Library, raw: Record<string, unknown>, at: string): Question {
  const bankRef = raw.bank ?? raw.bankId ?? raw.bankName;
  const created = typeof bankRef === "string" && !findBank(lib, bankRef);
  const bank = ensureBank(lib, bankRef, at);
  const subject = optionalText(raw.subject);
  if (subject && (created || bank.subject === "未分类")) bank.subject = subject;
  const chapterName = optionalText(raw.chapter ?? raw.chapterName) ?? "未分章";
  const chapter = ensureChapter(lib, bank, chapterName);
  const givenId = optionalText(raw.id);
  const stemHint = optionalText(raw.stem ?? raw.question ?? raw.title);
  const existing =
    lib.questions.find((question) => question.id === givenId) ??
    (stemHint ? lib.questions.find((question) => question.bankId === bank.id && question.stem === stemHint) : undefined);
  const explicitFrame = "frame" in raw;
  const parsedFrame = explicitFrame ? readFrame(raw) : undefined;
  const keepFrame = !explicitFrame && existing?.frame && (raw.type === undefined || raw.type === "frame" || raw.type === "框架" || raw.type === "框架题")
    ? existing.frame
    : undefined;
  const frame = parsedFrame ?? keepFrame;
  const stem = (stemHint || frame?.stem.split("\n")[0] || frame?.typeName || "").slice(0, 4000);
  if (!stem) throw new Error("题干不能为空");
  let type: QType;
  let choices: Question["choices"];
  let answer: string[];
  if (frame) {
    type = "frame";
    choices = [];
    answer = canonicalChosen(frame);
  } else {
    type = inferType(raw.type, raw.choices ?? raw.options, raw.answer);
    if (type === "frame") throw new Error("框架题要在 frame 里写上 @frame … @end");
    choices = normalizeChoices(type, raw.choices ?? raw.options);
    answer = normalizeAnswer(type, raw.answer, choices);
  }
  const writtenExplanation = optionalText(raw.explanation ?? raw.explain);
  const explanation = writtenExplanation ?? (frame ? summarizeExplain(frame) : existing?.explanation ?? "");
  const question: Question = {
    id: existing?.id ?? givenId ?? uid("q"),
    bankId: bank.id,
    chapterId: chapter.id,
    type,
    stem,
    choices,
    answer,
    explanation,
    difficulty: difficultyOf(raw.difficulty ?? raw.hard ?? existing?.difficulty),
    tags: raw.tags === undefined && existing ? existing.tags : tagsOf(raw.tags),
    source: optionalText(raw.source) ?? existing?.source ?? "agent",
    frame,
  };
  if (existing) {
    const index = lib.questions.findIndex((item) => item.id === existing.id);
    lib.questions[index] = question;
  } else {
    if (lib.questions.length >= 5000) throw new Error("题库已达 5000 题上限");
    lib.questions.push(question);
  }
  touch(lib, bank.id, at);
  return question;
}

function deleteQuestion(lib: Library, id: string) {
  lib.questions = lib.questions.filter((question) => question.id !== id);
  lib.wrongs = lib.wrongs.filter((item) => item.questionId !== id);
  lib.favorites = lib.favorites.filter((item) => item !== id);
  lib.notes = lib.notes.filter((item) => item.questionId !== id);
  for (const paper of lib.papers) {
    paper.questionIds = paper.questionIds.filter((item) => item !== id);
  }
}

function sampleIds(ids: string[], count: number): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = swap;
  }
  return copy.slice(0, count);
}

function applyOne(lib: Library, raw: unknown, index: number, at: string): OpResult {
  const record = asRecord(raw);
  const op = text(record.op, "op");
  if (op === "bank.create") {
    const name = text(record.name, "题库名称");
    if (lib.banks.some((bank) => bank.name === name)) throw new Error(`题库「${name}」已存在`);
    const bank: Bank = {
      id: uid("bank"),
      name,
      subject: optionalText(record.subject) ?? "未分类",
      description: optionalText(record.description) ?? "",
      createdAt: at,
      updatedAt: at,
    };
    lib.banks.push(bank);
    return { index, op, ok: true, message: `已建题库 ${name}`, id: bank.id };
  }
  if (op === "bank.update") {
    const bank = requireBank(lib, record.id ?? record.bank ?? record.name);
    const nextName = optionalText(record.name);
    if (nextName && nextName !== bank.name) {
      if (lib.banks.some((item) => item.name === nextName)) throw new Error(`题库「${nextName}」已存在`);
      bank.name = nextName;
    }
    if (typeof record.subject === "string") bank.subject = record.subject.trim() || "未分类";
    if (typeof record.description === "string") bank.description = record.description.trim();
    bank.updatedAt = at;
    return { index, op, ok: true, message: `已更新题库 ${bank.name}`, id: bank.id };
  }
  if (op === "bank.delete") {
    const bank = requireBank(lib, record.id ?? record.bank ?? record.name);
    const ids = new Set(lib.questions.filter((q) => q.bankId === bank.id).map((q) => q.id));
    lib.banks = lib.banks.filter((item) => item.id !== bank.id);
    lib.chapters = lib.chapters.filter((item) => item.bankId !== bank.id);
    lib.questions = lib.questions.filter((item) => item.bankId !== bank.id);
    lib.papers = lib.papers.filter((item) => item.bankId !== bank.id);
    lib.wrongs = lib.wrongs.filter((item) => !ids.has(item.questionId));
    lib.favorites = lib.favorites.filter((item) => !ids.has(item));
    lib.notes = lib.notes.filter((item) => !ids.has(item.questionId));
    return { index, op, ok: true, message: `已删除题库 ${bank.name}`, id: bank.id };
  }
  if (op === "chapter.upsert") {
    const bank = requireBank(lib, record.bank ?? record.bankId);
    const name = text(record.name, "章节名");
    const chapter = ensureChapter(lib, bank, name);
    if (typeof record.order === "number") chapter.order = record.order;
    touch(lib, bank.id, at);
    return { index, op, ok: true, message: `章节 ${name}`, id: chapter.id };
  }
  if (op === "chapter.rename") {
    const bank = requireBank(lib, record.bank ?? record.bankId);
    const from = text(record.from ?? record.chapter ?? record.id, "章节");
    const to = text(record.to ?? record.name, "新章节名");
    const chapter = lib.chapters.find((item) => item.bankId === bank.id && (item.id === from || item.name === from));
    if (!chapter) throw new Error(`找不到章节「${from}」`);
    if (chapter.name !== to && lib.chapters.some((item) => item.bankId === bank.id && item.name === to)) {
      throw new Error(`章节「${to}」已存在`);
    }
    chapter.name = to;
    touch(lib, bank.id, at);
    return { index, op, ok: true, message: `章节已改为 ${to}`, id: chapter.id };
  }
  if (op === "chapter.delete") {
    const bank = requireBank(lib, record.bank ?? record.bankId);
    const ref = text(record.chapter ?? record.name ?? record.id, "章节");
    const chapter = lib.chapters.find((item) => item.bankId === bank.id && (item.id === ref || item.name === ref));
    if (!chapter) throw new Error(`找不到章节「${ref}」`);
    const left = lib.questions.filter((question) => question.chapterId === chapter.id);
    if (left.length && chapter.name === "未分章") throw new Error("未分章里还有题目，请先删掉或改到别的章节");
    if (left.length) {
      const sink = ensureChapter(lib, bank, "未分章");
      if (sink.id === chapter.id) throw new Error("未分章里还有题目，请先删掉或改到别的章节");
      for (const question of left) question.chapterId = sink.id;
    }
    lib.chapters = lib.chapters.filter((item) => item.id !== chapter.id);
    touch(lib, bank.id, at);
    return {
      index,
      op,
      ok: true,
      message: left.length ? `已删除章节，${left.length} 题改到未分章` : "已删除空章节",
      id: chapter.id,
    };
  }
  if (op === "question.upsert") {
    const question = upsertQuestion(lib, record, at);
    return { index, op, ok: true, message: `已写入：${question.stem.slice(0, 28)}`, id: question.id };
  }
  if (op === "question.bulk") {
    const items = record.items ?? record.questions;
    if (!Array.isArray(items) || !items.length) throw new Error("items 不能为空");
    if (items.length > 200) throw new Error("一次最多 200 题");
    let ok = 0;
    const fails: string[] = [];
    let lastId = "";
    items.forEach((item, itemIndex) => {
      try {
        const body = asRecord(item, "题目");
        const question = upsertQuestion(
          lib,
          {
            ...body,
            bank: body.bank ?? body.bankId ?? record.bank,
            chapter: body.chapter ?? body.chapterName ?? record.chapter,
          },
          at,
        );
        ok += 1;
        lastId = question.id;
      } catch (error) {
        fails.push(`#${itemIndex + 1} ${error instanceof Error ? error.message : "失败"}`);
      }
    });
    return {
      index,
      op,
      ok: ok > 0,
      message: fails.length ? `写入 ${ok} 题，失败 ${fails.length}：${fails.slice(0, 3).join("；")}` : `写入 ${ok} 题`,
      id: lastId,
    };
  }
  if (op === "question.delete") {
    const id = optionalText(record.id);
    const question = id
      ? lib.questions.find((item) => item.id === id)
      : lib.questions.find((item) => item.stem === optionalText(record.stem));
    if (!question) throw new Error("找不到要删除的题");
    deleteQuestion(lib, question.id);
    return { index, op, ok: true, message: "已删除题目", id: question.id };
  }
  if (op === "wrong.master") {
    const id = text(record.questionId ?? record.id, "questionId");
    const mastered = record.mastered !== false;
    const prev = lib.wrongs.find((item) => item.questionId === id);
    lib.wrongs = lib.wrongs.filter((item) => item.questionId !== id);
    lib.wrongs.push({
      questionId: id,
      wrongCount: prev?.wrongCount ?? 1,
      correctStreak: mastered ? 2 : 0,
      mastered,
      lastAt: at,
    });
    return { index, op, ok: true, message: mastered ? "已标为掌握" : "已放回错题", id };
  }
  if (op === "favorite.toggle" || op === "favorite.set") {
    const id = text(record.questionId ?? record.id, "questionId");
    const has = lib.favorites.includes(id);
    const should = op === "favorite.set" ? Boolean(record.on ?? record.favorite) : !has;
    lib.favorites = lib.favorites.filter((item) => item !== id);
    if (should) lib.favorites.push(id);
    return { index, op, ok: true, message: should ? "已收藏" : "已取消收藏", id };
  }
  if (op === "note.set") {
    const id = text(record.questionId ?? record.id, "questionId");
    const note = typeof record.text === "string" ? record.text.trim().slice(0, 2000) : "";
    lib.notes = lib.notes.filter((item) => item.questionId !== id);
    if (note) lib.notes.push({ questionId: id, text: note, at });
    return { index, op, ok: true, message: note ? "已记下" : "已清除笔记", id };
  }
  if (op === "paper.create") {
    const name = text(record.name, "试卷名称");
    const bankRef = optionalText(record.bank ?? record.bankId);
    const bank = bankRef ? requireBank(lib, bankRef) : undefined;
    let ids = Array.isArray(record.questionIds)
      ? record.questionIds.map((item) => String(item)).filter((id) => lib.questions.some((q) => q.id === id))
      : [];
    if (!ids.length) {
      const from = optionalText(record.from) ?? "bank";
      let pool = lib.questions.filter((q) => (bank ? q.bankId === bank.id : true));
      if (from === "wrong") {
        const wrongIds = new Set(lib.wrongs.filter((item) => !item.mastered).map((item) => item.questionId));
        pool = pool.filter((q) => wrongIds.has(q.id));
      }
      const chapter = optionalText(record.chapter);
      if (chapter && bank) {
        const found = lib.chapters.find((item) => item.bankId === bank.id && (item.id === chapter || item.name === chapter));
        if (found) pool = pool.filter((q) => q.chapterId === found.id);
      }
      const count = clampInt(record.count ?? 10, 10, 1, 100);
      ids = sampleIds(pool.map((q) => q.id), count);
    }
    if (!ids.length) throw new Error("没有可抽的题目");
    const paper: Paper = {
      id: uid("paper"),
      name,
      bankId: bank?.id ?? null,
      questionIds: ids,
      durationMin: clampInt(record.durationMin ?? 20, 20, 1, 240),
      createdAt: at,
    };
    lib.papers.unshift(paper);
    return { index, op, ok: true, message: `试卷「${name}」${ids.length} 题`, id: paper.id };
  }
  if (op === "paper.delete") {
    const ref = text(record.id ?? record.name, "试卷");
    const paper = lib.papers.find((item) => item.id === ref || item.name === ref);
    if (!paper) throw new Error("找不到试卷");
    lib.papers = lib.papers.filter((item) => item.id !== paper.id);
    return { index, op, ok: true, message: `已删除试卷 ${paper.name}`, id: paper.id };
  }
  if (op === "progress.reset") {
    lib.attempts = [];
    lib.wrongs = [];
    lib.exams = [];
    lib.resume = {};
    return { index, op, ok: true, message: "已清空做题记录，题目还在" };
  }
  throw new Error(`不认识的操作 ${op}`);
}

export function applyOps(library: Library, rawOps: unknown[], at = new Date().toISOString()) {
  const next = structuredClone(library);
  const results: OpResult[] = [];
  if (!Array.isArray(rawOps)) {
    return {
      library: next,
      results: [{ index: 0, op: "unknown", ok: false, message: "ops 必须是数组" }],
    };
  }
  if (rawOps.length > 200) {
    return {
      library: next,
      results: [{ index: 0, op: "unknown", ok: false, message: "一次最多 200 条操作" }],
    };
  }
  rawOps.forEach((raw, index) => {
    try {
      results.push(applyOne(next, raw, index, at));
    } catch (error) {
      results.push({
        index,
        op: opName(raw),
        ok: false,
        message: error instanceof Error ? error.message : "失败",
      });
    }
  });
  return { library: next, results };
}

export function questionPublic(question: Question, lib: Library) {
  const bank = lib.banks.find((item) => item.id === question.bankId);
  const chapter = lib.chapters.find((item) => item.id === question.chapterId);
  return {
    id: question.id,
    bank: bank?.name ?? question.bankId,
    chapter: chapter?.name ?? "",
    type: question.type,
    stem: question.stem,
    choices: question.choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice.text}`),
    answer: answerLabel(question),
    explanation: question.explanation,
    difficulty: question.difficulty,
    tags: question.tags,
  };
}
