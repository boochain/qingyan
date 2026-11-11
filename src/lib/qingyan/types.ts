import type { ItemFrame } from "./frame";

export type QType = "single" | "multi" | "judge" | "blank" | "short" | "frame";

export type PracticeMode =
  | "order"
  | "random"
  | "chapter"
  | "wrong"
  | "recite"
  | "paper"
  | "favorite";

export interface Bank {
  id: string;
  name: string;
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  bankId: string;
  name: string;
  order: number;
}

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  bankId: string;
  chapterId: string;
  type: QType;
  stem: string;
  choices: Choice[];
  answer: string[];
  explanation: string;
  difficulty: 1 | 2 | 3;
  tags: string[];
  source: string;
  frame?: ItemFrame;
}

export interface Attempt {
  id: string;
  questionId: string;
  bankId: string;
  mode: PracticeMode;
  chosen: string[];
  correct: boolean;
  at: string;
}

export interface WrongState {
  questionId: string;
  wrongCount: number;
  correctStreak: number;
  mastered: boolean;
  lastAt: string;
}

export interface Note {
  questionId: string;
  text: string;
  at: string;
}

export interface Paper {
  id: string;
  name: string;
  bankId: string | null;
  questionIds: string[];
  durationMin: number;
  createdAt: string;
}

export interface ExamDetail {
  questionId: string;
  chosen: string[];
  correct: boolean;
}

export interface ExamResult {
  id: string;
  paperId: string;
  paperName: string;
  score: number;
  total: number;
  durationSec: number;
  at: string;
  details: ExamDetail[];
}

export interface Resume {
  ids: string[];
  index: number;
}

export interface Library {
  version: 1;
  banks: Bank[];
  chapters: Chapter[];
  questions: Question[];
  attempts: Attempt[];
  wrongs: WrongState[];
  favorites: string[];
  notes: Note[];
  papers: Paper[];
  exams: ExamResult[];
  resume: Record<string, Resume>;
  dailyGoal: number;
  flags: string[];
}

export const TYPE_LABEL: Record<QType, string> = {
  single: "单选",
  multi: "多选",
  judge: "判断",
  blank: "填空",
  short: "简答",
  frame: "框架",
};

export const MODE_LABEL: Record<PracticeMode, string> = {
  order: "顺序",
  random: "随机",
  chapter: "章节",
  wrong: "错题",
  recite: "背题",
  paper: "试卷",
  favorite: "收藏",
};

export function emptyLibrary(): Library {
  return {
    version: 1,
    banks: [],
    chapters: [],
    questions: [],
    attempts: [],
    wrongs: [],
    favorites: [],
    notes: [],
    papers: [],
    exams: [],
    resume: {},
    dailyGoal: 20,
    flags: [],
  };
}

export function typeLabelOf(question: { type: QType; frame?: { typeName?: string } | null }): string {
  return question.frame?.typeName || TYPE_LABEL[question.type];
}
