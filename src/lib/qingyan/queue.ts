import type { Library, PracticeMode } from "./types";

export function shuffle<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = next[i];
    next[i] = next[j]!;
    next[j] = swap!;
  }
  return next;
}

export function orderedQuestions(lib: Library, bankId: string) {
  const chapters = lib.chapters
    .filter((chapter) => chapter.bankId === bankId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh"));
  const rank = new Map(chapters.map((chapter, index) => [chapter.id, index]));
  const written = new Map(lib.questions.map((question, index) => [question.id, index]));
  return lib.questions
    .filter((question) => question.bankId === bankId)
    .slice()
    .sort(
      (a, b) =>
        (rank.get(a.chapterId) ?? 99) - (rank.get(b.chapterId) ?? 99) ||
        (written.get(a.id) ?? 0) - (written.get(b.id) ?? 0),
    );
}

export function buildQueue(
  lib: Library,
  bankId: string,
  mode: PracticeMode,
  chapterId: string,
): string[] {
  let questions = orderedQuestions(lib, bankId);
  if ((mode === "chapter" || mode === "order") && chapterId) {
    questions = questions.filter((question) => question.chapterId === chapterId);
  }
  if (mode === "wrong") {
    const ids = new Set(
      lib.wrongs.filter((item) => !item.mastered).map((item) => item.questionId),
    );
    questions = questions.filter((question) => ids.has(question.id));
  }
  if (mode === "favorite") {
    const ids = new Set(lib.favorites);
    questions = questions.filter((question) => ids.has(question.id));
  }
  let ids = questions.map((question) => question.id);
  if (mode === "random") ids = shuffle(ids);
  return ids;
}

export function resumeKey(bankId: string, mode: PracticeMode, chapterId: string): string {
  return `${bankId}:${mode}:${chapterId}`;
}
