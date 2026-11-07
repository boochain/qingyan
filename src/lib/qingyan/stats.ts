import type { Attempt, Library } from "./types";

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function relTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

export function todayCount(attempts: Attempt[], now = new Date()): number {
  const key = dayKey(now);
  return attempts.filter((item) => dayKey(new Date(item.at)) === key).length;
}

export function accuracyOf(attempts: Attempt[]): number | null {
  if (!attempts.length) return null;
  const good = attempts.filter((item) => item.correct).length;
  return Math.round((good / attempts.length) * 100);
}

export function streakDays(attempts: Attempt[], now = new Date()): number {
  const days = new Set(attempts.map((item) => dayKey(new Date(item.at))));
  if (!days.size) return 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export interface DayBar {
  date: string;
  label: string;
  count: number;
  correct: number;
}

export function lastDays(attempts: Attempt[], days = 14, now = new Date()): DayBar[] {
  const buckets = new Map<string, DayBar>();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(start);
    date.setDate(start.getDate() - i);
    const key = dayKey(date);
    buckets.set(key, {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: 0,
      correct: 0,
    });
  }
  for (const attempt of attempts) {
    const bucket = buckets.get(dayKey(new Date(attempt.at)));
    if (!bucket) continue;
    bucket.count += 1;
    if (attempt.correct) bucket.correct += 1;
  }
  return [...buckets.values()];
}

export function bankAccuracy(lib: Library, bankId: string): number | null {
  return accuracyOf(lib.attempts.filter((item) => item.bankId === bankId));
}

export function unmasteredCount(lib: Library, bankId?: string): number {
  return lib.wrongs.filter((item) => {
    if (item.mastered) return false;
    if (!bankId) return true;
    const question = lib.questions.find((q) => q.id === item.questionId);
    return question?.bankId === bankId;
  }).length;
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return "夜深了";
  if (hour < 11) return "清晨";
  if (hour < 14) return "午后";
  if (hour < 18) return "黄昏";
  return "夜里";
}
