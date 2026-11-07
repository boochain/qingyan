import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isCorrect, nextWrongState } from "./grade";
import { applyOps, type OpResult } from "./ops";
import { seedLibrary } from "./seed";
import {
  emptyLibrary,
  type Attempt,
  type Library,
  type PracticeMode,
  type Resume,
} from "./types";

interface QingyanState {
  lib: Library;
  apply: (ops: unknown[]) => OpResult[];
  replace: (lib: Library) => void;
  resetDemo: () => void;
  clearAll: () => void;
  recordAnswer: (questionId: string, chosen: string[], mode: PracticeMode) => boolean;
  toggleFavorite: (questionId: string) => void;
  setNote: (questionId: string, text: string) => void;
  setResume: (key: string, resume: Resume) => void;
  clearResume: (key: string) => void;
  setDailyGoal: (goal: number) => void;
  setMastered: (questionId: string, mastered: boolean) => void;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function normalize(lib: Library): Library {
  const base = emptyLibrary();
  return {
    ...base,
    ...lib,
    version: 1,
    dailyGoal: lib.dailyGoal || 20,
    resume: lib.resume ?? {},
  };
}

export const useQingyan = create<QingyanState>()(
  persist(
    (set, get) => ({
      lib: seedLibrary(),
      apply: (ops) => {
        const out = applyOps(get().lib, ops);
        set({ lib: out.library });
        return out.results;
      },
      replace: (lib) => set({ lib: normalize(lib) }),
      resetDemo: () => set({ lib: seedLibrary() }),
      clearAll: () => set({ lib: emptyLibrary() }),
      recordAnswer: (questionId, chosen, mode) => {
        const lib = get().lib;
        const question = lib.questions.find((item) => item.id === questionId);
        if (!question) return false;
        const correct = isCorrect(question, chosen);
        const at = new Date().toISOString();
        const attempt: Attempt = {
          id: uid("at"),
          questionId,
          bankId: question.bankId,
          mode,
          chosen,
          correct,
          at,
        };
        const prev = lib.wrongs.find((item) => item.questionId === questionId);
        const next = nextWrongState(prev, questionId, correct, at);
        const wrongs = lib.wrongs.filter((item) => item.questionId !== questionId);
        if (next) wrongs.push(next);
        set({
          lib: {
            ...lib,
            attempts: [...lib.attempts, attempt].slice(-2000),
            wrongs,
          },
        });
        return correct;
      },
      toggleFavorite: (questionId) => {
        const lib = get().lib;
        const favorites = lib.favorites.includes(questionId)
          ? lib.favorites.filter((id) => id !== questionId)
          : [...lib.favorites, questionId];
        set({ lib: { ...lib, favorites } });
      },
      setNote: (questionId, text) => {
        const lib = get().lib;
        const notes = lib.notes.filter((item) => item.questionId !== questionId);
        const trimmed = text.trim();
        if (trimmed) notes.push({ questionId, text: trimmed.slice(0, 2000), at: new Date().toISOString() });
        set({ lib: { ...lib, notes } });
      },
      setResume: (key, resume) => {
        const lib = get().lib;
        set({ lib: { ...lib, resume: { ...lib.resume, [key]: resume } } });
      },
      clearResume: (key) => {
        const lib = get().lib;
        const resume = { ...lib.resume };
        delete resume[key];
        set({ lib: { ...lib, resume } });
      },
      setDailyGoal: (goal) => {
        const lib = get().lib;
        set({ lib: { ...lib, dailyGoal: Math.min(200, Math.max(5, Math.round(goal))) } });
      },
      setMastered: (questionId, mastered) => {
        get().apply([{ op: "wrong.master", questionId, mastered }]);
      },
    }),
    {
      name: "qingyan-library-v1",
      skipHydration: true,
      partialize: (state) => ({ lib: state.lib }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<QingyanState> | undefined;
        if (!saved?.lib || saved.lib.version !== 1 || !Array.isArray(saved.lib.questions)) return current;
        return { ...current, lib: normalize(saved.lib) };
      },
    },
  ),
);
