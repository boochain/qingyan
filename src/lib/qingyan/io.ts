import { frameToText } from "./frame";
import { applyOps } from "./ops";
import { OP_CHUNK } from "./run-ops";
import { seedLibrary } from "./seed";
import { rowsToOps, tableObjectToOps } from "./rows";
import { emptyLibrary, type Library, type QType, type Question } from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim()));
}

export function csvToOps(text: string, fallbackBank: string): unknown[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV 至少要有表头和一行题目");
  const header = rows[0]!.map((item) => item.trim());
  const hasStem = header.some((item) => ["stem", "题干", "题目", "question"].includes(item.toLowerCase()));
  if (!hasStem) throw new Error("CSV 需要「题干」列");
  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? "";
    });
    return record;
  });
  return rowsToOps(records, { bank: fallbackBank, source: "csv" });
}

export function textToOps(text: string, fallbackBank: string): unknown[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let bank = fallbackBank || "导入的题库";
  let subject = "";
  let chapter = "未分章";
  const blocks: { bank: string; chapter: string; subject: string; body: string }[] = [];
  let buf: string[] = [];
  let inFrame = false;
  const flush = () => {
    if (buf.some((line) => line.trim())) {
      blocks.push({ bank, chapter, subject, body: buf.join("\n") });
    }
    buf = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^@frame\b/.test(trimmed)) inFrame = true;
    if (inFrame) {
      buf.push(line);
      if (/^@end\b/.test(trimmed)) inFrame = false;
      continue;
    }
    const h1 = /^#\s+(.+)/.exec(line);
    const h2 = /^##\s+(.+)/.exec(line);
    if (h1 && !line.startsWith("##")) {
      flush();
      bank = h1[1]!.trim();
      subject = "";
      continue;
    }
    if (h2) {
      flush();
      chapter = h2[1]!.trim();
      continue;
    }
    if (/^科目\s*[:：]/.test(trimmed) && !buf.some((item) => item.trim())) {
      subject = trimmed.replace(/^科目\s*[:：]\s*/, "").trim();
      continue;
    }
    const closed = buf.some((item) => /^答案\s*[:：]/.test(item.trim()) || /^@end\b/.test(item.trim()));
    if (!trimmed) {
      if (closed) flush();
      continue;
    }
    if (/^\d+\s*[.、．]/.test(trimmed) && closed) flush();
    buf.push(line);
  }
  flush();
  const ops: unknown[] = [];
  for (const block of blocks) {
    const op = blockToOp(block.body, block.bank, block.chapter, block.subject);
    if (op) ops.push(op);
  }
  if (!ops.length) throw new Error("没有识别到带「答案」的题目");
  return ops;
}

function blockToOp(body: string, bank: string, chapter: string, subject = ""): Record<string, unknown> | null {
  const fenced = /@frame\b[\s\S]*?@end/.exec(body);
  const frameText = fenced?.[0];
  const rest = fenced ? body.replace(fenced[0], "\n") : body;
  const lines = rest.split("\n").map((line) => line.trim()).filter(Boolean);
  const choices: string[] = [];
  const stemLines: string[] = [];
  let answer = "";
  let explanation = "";
  let difficulty = "";
  let tags = "";
  let type = "";
  let localChapter = chapter;
  let seenChoice = false;
  for (const line of lines) {
    const choice = /^([A-Ha-h])[.、．)\s]\s*(.*)/.exec(line);
    const meta = /^(答案|解析|难度|标签|题型|章节|来源)\s*[:：]\s*(.*)$/.exec(line);
    if (choice && !meta) {
      seenChoice = true;
      choices.push(choice[2] ?? "");
      continue;
    }
    if (meta) {
      const key = meta[1]!;
      const value = meta[2] ?? "";
      if (key === "答案") answer = value;
      else if (key === "解析") explanation = value;
      else if (key === "难度") difficulty = value;
      else if (key === "标签") tags = value;
      else if (key === "题型") type = value;
      else if (key === "章节") localChapter = value || localChapter;
      continue;
    }
    if (!seenChoice) stemLines.push(line.replace(/^\d+\s*[.、．]\s*/, ""));
    else explanation = explanation ? `${explanation} ${line}` : line;
  }
  const stem = stemLines.join("\n").trim();
  if (frameText) {
    if (!stem && !frameText) return null;
    return {
      op: "question.upsert",
      bank,
      chapter: localChapter,
      type: type || "框架",
      stem: stem || "框架题",
      choices,
      answer: answer || "-",
      explanation,
      difficulty: difficulty || undefined,
      tags,
      source: "文本导入",
      frame: frameText,
      ...(subject ? { subject } : {}),
    };
  }
  if (!stem || !answer) return null;
  return {
    op: "question.upsert",
    bank,
    chapter: localChapter,
    type: type || undefined,
    stem,
    choices,
    answer,
    explanation,
    difficulty: difficulty || undefined,
    tags,
    source: "文本导入",
    ...(subject ? { subject } : {}),
  };
}

function bulkChunks(bank: string, items: unknown[]): unknown[] {
  const ops: unknown[] = [];
  for (let index = 0; index < items.length; index += 200) {
    ops.push({ op: "question.bulk", bank, items: items.slice(index, index + 200) });
  }
  return ops;
}

function isLibrary(value: unknown): value is Library {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Library>;
  return record.version === 1 && Array.isArray(record.banks) && Array.isArray(record.questions);
}

export type ImportPlan =
  | { kind: "replace"; library: Library }
  | { kind: "ops"; ops: unknown[] };

export function parseImport(text: string, fallbackBank: string): ImportPlan {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("内容是空的");
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error("JSON 解析失败");
    }
    if (Array.isArray(data)) {
      if (data.length && data.every((item) => item && typeof item === "object" && "op" in item)) {
        return { kind: "ops", ops: data };
      }
      return {
        kind: "ops",
        ops: bulkChunks(fallbackBank || "导入的题库", data),
      };
    }
    if (isLibrary(data)) return { kind: "replace", library: normalizeIncoming(data) };
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (typeof record.op === "string") return { kind: "ops", ops: [record] };
      if (record.format === "qingyan.table/1" || (Array.isArray(record.rows) && !Array.isArray(record.questions))) {
        return { kind: "ops", ops: tableObjectToOps(record, fallbackBank || "导入的题库") };
      }
      if (Array.isArray(record.ops)) return { kind: "ops", ops: record.ops };
      if (Array.isArray(record.questions)) {
        const bank = typeof record.bank === "string" ? record.bank : fallbackBank || "导入的题库";
        return { kind: "ops", ops: bulkChunks(bank, record.questions) };
      }
    }
    throw new Error("认不出这份 JSON。可以是整库、题目数组、ops，或 qingyan.table/1。");
  }
  if (trimmed.includes("答案") || trimmed.includes("@frame")) return { kind: "ops", ops: textToOps(trimmed, fallbackBank || "导入的题库") };
  return { kind: "ops", ops: csvToOps(trimmed, fallbackBank || "导入的题库") };
}

function normalizeIncoming(lib: Library): Library {
  const base = emptyLibrary();
  return {
    ...base,
    ...lib,
    version: 1,
    banks: lib.banks ?? [],
    chapters: lib.chapters ?? [],
    questions: lib.questions ?? [],
    attempts: lib.attempts ?? [],
    wrongs: lib.wrongs ?? [],
    favorites: lib.favorites ?? [],
    notes: lib.notes ?? [],
    papers: lib.papers ?? [],
    exams: lib.exams ?? [],
    resume: lib.resume ?? {},
    dailyGoal: lib.dailyGoal || 20,
    flags: lib.flags ?? [],
  };
}

export function mergeLibrary(base: Library, incoming: Library): Library {
  const next = structuredClone(base);
  const bankIdMap = new Map<string, string>();
  for (const bank of incoming.banks) {
    const found = next.banks.find((item) => item.name === bank.name);
    if (found) bankIdMap.set(bank.id, found.id);
    else {
      next.banks.push({ ...bank });
      bankIdMap.set(bank.id, bank.id);
    }
  }
  const chapterIdMap = new Map<string, string>();
  for (const chapter of incoming.chapters) {
    const bankId = bankIdMap.get(chapter.bankId) ?? chapter.bankId;
    const found = next.chapters.find((item) => item.bankId === bankId && item.name === chapter.name);
    if (found) chapterIdMap.set(chapter.id, found.id);
    else {
      const copy = { ...chapter, bankId };
      next.chapters.push(copy);
      chapterIdMap.set(chapter.id, copy.id);
    }
  }
  for (const question of incoming.questions) {
    const bankId = bankIdMap.get(question.bankId) ?? question.bankId;
    const chapterId = chapterIdMap.get(question.chapterId) ?? question.chapterId;
    const copy: Question = { ...question, bankId, chapterId };
    const index = next.questions.findIndex(
      (item) => item.id === question.id || (item.bankId === bankId && item.stem === question.stem),
    );
    if (index >= 0) {
      copy.id = next.questions[index]!.id;
      next.questions[index] = copy;
    } else next.questions.push(copy);
  }
  return next;
}

export function libraryToCsv(lib: Library): string {
  const header = ["题库", "科目", "章节", "题型", "题干", "选项A", "选项B", "选项C", "选项D", "选项E", "选项F", "答案", "解析", "难度", "标签", "框架", "来源", "编号"];
  const lines = [header.map(csvEscape).join(",")];
  for (const question of lib.questions) {
    const bank = lib.banks.find((item) => item.id === question.bankId);
    const chapter = lib.chapters.find((item) => item.id === question.chapterId)?.name ?? "";
    const slots = ["", "", "", "", "", ""];
    question.choices.forEach((choice, index) => {
      if (index < 6) slots[index] = choice.text;
    });
    const answer =
      question.type === "single" || question.type === "multi"
        ? question.answer
            .map((id) => {
              const index = question.choices.findIndex((choice) => choice.id === id);
              return index >= 0 ? String.fromCharCode(65 + index) : id;
            })
            .join(",")
        : question.type === "judge"
          ? question.answer[0] === "T"
            ? "对"
            : "错"
          : question.answer.join("|");
    lines.push(
      [
        bank?.name ?? "",
        bank?.subject ?? "",
        chapter,
        typeLabel(question.type),
        question.stem,
        ...slots,
        answer,
        question.explanation,
        String(question.difficulty),
        question.tags.join("|"),
        question.frame ? frameToText(question.frame) : "",
        question.source,
        question.id,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function typeLabel(type: QType): string {
  if (type === "single") return "单选";
  if (type === "multi") return "多选";
  if (type === "judge") return "判断";
  if (type === "blank") return "填空";
  if (type === "frame") return "框架";
  return "简答";
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function libraryToMarkdown(lib: Library): string {
  const parts: string[] = ["# 青砚题库", ""];
  for (const bank of lib.banks) {
    parts.push(`# ${bank.name}`, "");
    if (bank.subject) parts.push(`科目：${bank.subject}`, "");
    const chapters = lib.chapters.filter((chapter) => chapter.bankId === bank.id).sort((a, b) => a.order - b.order);
    for (const chapter of chapters) {
      parts.push(`## ${chapter.name}`, "");
      const questions = lib.questions.filter((q) => q.chapterId === chapter.id);
      questions.forEach((question, index) => {
        parts.push(`${index + 1}. ${question.stem}`);
        parts.push(`题型：${question.frame?.typeName || typeLabel(question.type)}`);
        if (question.frame) {
          parts.push(frameToText(question.frame));
          parts.push(`答案：${question.answer.join(" ; ")}`);
          if (question.explanation) parts.push(`解析：${question.explanation}`);
          if (question.tags.length) parts.push(`标签：${question.tags.join("|")}`);
          parts.push("");
          return;
        }
        if (question.type !== "judge") {
          question.choices.forEach((choice, choiceIndex) => {
            parts.push(`${String.fromCharCode(65 + choiceIndex)}. ${choice.text}`);
          });
        }
        const answer =
          question.type === "judge"
            ? question.answer[0] === "T"
              ? "对"
              : "错"
            : question.type === "single" || question.type === "multi"
              ? question.answer
                  .map((id) => {
                    const i = question.choices.findIndex((choice) => choice.id === id);
                    return i >= 0 ? String.fromCharCode(65 + i) : id;
                  })
                  .join(",")
              : question.answer.join("|");
        parts.push(`答案：${answer}`);
        if (question.explanation) parts.push(`解析：${question.explanation}`);
        parts.push(`难度：${question.difficulty}`);
        if (question.tags.length) parts.push(`标签：${question.tags.join("|")}`);
        parts.push("");
      });
    }
  }
  return parts.join("\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function applyImport(lib: Library, plan: ImportPlan, how: "merge" | "replace"): Library {
  if (plan.kind === "ops") {
    let next = lib;
    for (let index = 0; index < plan.ops.length; index += OP_CHUNK) {
      next = applyOps(next, plan.ops.slice(index, index + OP_CHUNK)).library;
    }
    return next;
  }
  if (how === "replace") return plan.library;
  return mergeLibrary(lib, plan.library);
}

export function sampleCsv(): string {
  return libraryToCsv(seedLibrary());
}
