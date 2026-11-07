import { applyOps } from "./ops";
import { seedLibrary } from "./seed";
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

function headerIndex(header: string[], names: string[]): number {
  const normalized = header.map((item) => item.trim().toLowerCase());
  return normalized.findIndex((item) => names.includes(item));
}

export function csvToOps(text: string, fallbackBank: string): unknown[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV 至少要有表头和一行题目");
  const header = rows[0]!.map((item) => item.trim());
  const col = (names: string[]) => headerIndex(header, names);
  const stemCol = col(["stem", "题干", "题目", "question"]);
  if (stemCol < 0) throw new Error("CSV 需要「题干」列");
  const pick = (row: string[], names: string[]) => {
    const index = col(names);
    return index >= 0 ? (row[index] ?? "").trim() : "";
  };
  return rows.slice(1).flatMap((row) => {
    const stem = (row[stemCol] ?? "").trim();
    if (!stem) return [];
    const choices = ["a", "b", "c", "d", "e", "f"]
      .map((letter) => pick(row, [letter, `选项${letter}`, `选项${letter.toUpperCase()}`]))
      .filter(Boolean);
    const bank = pick(row, ["bank", "题库"]) || fallbackBank;
    const chapter = pick(row, ["chapter", "章节"]) || "未分章";
    return [
      {
        op: "question.upsert",
        bank,
        chapter,
        type: pick(row, ["type", "题型"]) || undefined,
        stem,
        choices,
        answer: pick(row, ["answer", "答案"]),
        explanation: pick(row, ["explanation", "解析"]),
        difficulty: pick(row, ["difficulty", "难度"]) || undefined,
        tags: pick(row, ["tags", "标签"]),
        source: pick(row, ["source", "来源"]) || "csv",
      },
    ];
  });
}

export function textToOps(text: string, fallbackBank: string): unknown[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let bank = fallbackBank || "导入的题库";
  let chapter = "未分章";
  const blocks: { bank: string; chapter: string; body: string }[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.some((line) => line.trim())) {
      blocks.push({ bank, chapter, body: buf.join("\n") });
    }
    buf = [];
  };
  for (const line of lines) {
    const h1 = /^#\s+(.+)/.exec(line);
    const h2 = /^##\s+(.+)/.exec(line);
    if (h1 && !line.startsWith("##")) {
      flush();
      bank = h1[1]!.trim();
      continue;
    }
    if (h2) {
      flush();
      chapter = h2[1]!.trim();
      continue;
    }
    if (/^\d+\s*[.、．]\s*/.test(line) && buf.length) flush();
    buf.push(line);
  }
  flush();
  const ops: unknown[] = [];
  for (const block of blocks) {
    const op = blockToOp(block.body, block.bank, block.chapter);
    if (op) ops.push(op);
  }
  if (!ops.length) throw new Error("没有识别到带「答案」的题目");
  return ops;
}

function blockToOp(body: string, bank: string, chapter: string): Record<string, unknown> | null {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
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
  };
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
        ops: [{ op: "question.bulk", bank: fallbackBank || "导入的题库", items: data }],
      };
    }
    if (isLibrary(data)) return { kind: "replace", library: normalizeIncoming(data) };
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record.ops)) return { kind: "ops", ops: record.ops };
      if (Array.isArray(record.questions)) {
        return {
          kind: "ops",
          ops: [
            {
              op: "question.bulk",
              bank: typeof record.bank === "string" ? record.bank : fallbackBank || "导入的题库",
              items: record.questions,
            },
          ],
        };
      }
    }
    throw new Error("认不出这份 JSON。可以是整库、题目数组，或 ops 数组。");
  }
  if (trimmed.includes("答案")) return { kind: "ops", ops: textToOps(trimmed, fallbackBank || "导入的题库") };
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
  const header = ["题库", "章节", "题型", "题干", "A", "B", "C", "D", "E", "F", "答案", "解析", "难度", "标签", "来源"];
  const lines = [header.map(csvEscape).join(",")];
  for (const question of lib.questions) {
    const bank = lib.banks.find((item) => item.id === question.bankId)?.name ?? "";
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
            .join("|")
        : question.type === "judge"
          ? question.answer[0] === "T"
            ? "对"
            : "错"
          : question.answer.join("|");
    lines.push(
      [bank, chapter, typeLabel(question.type), question.stem, ...slots, answer, question.explanation, String(question.difficulty), question.tags.join("|"), question.source]
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
    const chapters = lib.chapters.filter((chapter) => chapter.bankId === bank.id).sort((a, b) => a.order - b.order);
    for (const chapter of chapters) {
      parts.push(`## ${chapter.name}`, "");
      const questions = lib.questions.filter((q) => q.chapterId === chapter.id);
      questions.forEach((question, index) => {
        parts.push(`${index + 1}. ${question.stem}`);
        question.choices.forEach((choice, choiceIndex) => {
          parts.push(`${String.fromCharCode(65 + choiceIndex)}. ${choice.text}`);
        });
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
                  .join("")
              : question.answer.join("|");
        parts.push(`答案：${answer}`);
        if (question.explanation) parts.push(`解析：${question.explanation}`);
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
  if (plan.kind === "ops") return applyOps(lib, plan.ops).library;
  if (how === "replace") return plan.library;
  return mergeLibrary(lib, plan.library);
}

export function sampleCsv(): string {
  return libraryToCsv(seedLibrary());
}
