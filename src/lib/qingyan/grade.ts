import { answerText, gradeFrame } from "./frame";
import type { Question, WrongState } from "./types";

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function isCorrect(question: Question, chosen: string[]): boolean {
  if (question.frame) return gradeFrame(question.frame, chosen).correct;
  if (question.type === "single" || question.type === "judge") {
    return chosen.length === 1 && chosen[0] === question.answer[0];
  }
  if (question.type === "multi") {
    if (chosen.length !== question.answer.length) return false;
    const a = [...question.answer].sort().join("\0");
    const b = [...chosen].sort().join("\0");
    return a === b;
  }
  const got = normalizeText(chosen[0] ?? "");
  if (!got) return false;
  if (question.type === "blank") {
    return question.answer.some((item) => normalizeText(item) === got);
  }
  return question.answer.every((keyword) => got.includes(normalizeText(keyword)));
}

export function answerLabel(question: Question): string {
  if (question.frame) return answerText(question.frame);
  if (question.type === "judge") {
    return question.answer[0] === "T" ? "正确" : "错误";
  }
  if (question.type === "single" || question.type === "multi") {
    return question.answer
      .map((id) => {
        const index = question.choices.findIndex((choice) => choice.id === id);
        const letter = index >= 0 ? String.fromCharCode(65 + index) : id;
        const text = question.choices.find((choice) => choice.id === id)?.text ?? "";
        return text ? `${letter}. ${text}` : letter;
      })
      .join("、");
  }
  return question.answer.join(" / ");
}

/** Two correct reviews in a row mark a wrong item mastered. */
export function nextWrongState(
  prev: WrongState | undefined,
  questionId: string,
  correct: boolean,
  at: string,
): WrongState | null {
  if (!correct) {
    return {
      questionId,
      wrongCount: (prev?.wrongCount ?? 0) + 1,
      correctStreak: 0,
      mastered: false,
      lastAt: at,
    };
  }
  if (!prev) return null;
  if (prev.mastered) return { ...prev, lastAt: at };
  const correctStreak = prev.correctStreak + 1;
  return {
    ...prev,
    correctStreak,
    mastered: correctStreak >= 2,
    lastAt: at,
  };
}
