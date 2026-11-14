import assert from "node:assert/strict";
import test from "node:test";
import { applyOps } from "./ops.ts";
import { clampDailyGoal, clearedLibrary } from "./store.ts";
import { emptyLibrary } from "./types.ts";
import { seedLibrary } from "./seed.ts";

test("daily goal rejects a half-typed number", () => {
  assert.equal(clampDailyGoal(Number.NaN), 20);
  assert.equal(clampDailyGoal(0), 5);
  assert.equal(clampDailyGoal(40.4), 40);
  assert.equal(clampDailyGoal(999), 200);
});

test("clearing keeps the demo from coming back", () => {
  const cleared = clearedLibrary();
  assert.equal(cleared.banks.length, 0);
  assert.equal(cleared.flags.includes("frame-demo"), true);
  const seeded = seedLibrary();
  assert.equal(seeded.banks.some((bank) => bank.id === "bank_frame"), true);
});

test("a blank paper count does not wipe the pool", () => {
  const lib = emptyLibrary();
  const made = applyOps(lib, [
    { op: "bank.create", name: "卷一", subject: "未分类" },
    {
      op: "question.upsert",
      bank: "卷一",
      type: "判断",
      stem: "天空是蓝的。",
      answer: "对",
    },
  ]);
  const paper = applyOps(made.library, [{ op: "paper.create", name: "小卷", bank: "卷一", count: Number.NaN, durationMin: Number.NaN }]);
  assert.equal(paper.results[0]?.ok, true);
  assert.equal(paper.library.papers[0]?.questionIds.length, 1);
  assert.equal(paper.library.papers[0]?.durationMin, 20);
});
