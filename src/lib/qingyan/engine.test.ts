import assert from "node:assert/strict";
import test from "node:test";
import { isCorrect, nextWrongState } from "./grade.ts";
import { parseImport, textToOps } from "./io.ts";
import { applyOps } from "./ops.ts";
import { seedLibrary } from "./seed.ts";
import type { Question } from "./types.ts";

test("seed grades a known single choice", () => {
  const lib = seedLibrary();
  const question = lib.questions.find((item) => item.id === "q_net_01");
  assert.ok(question);
  assert.equal(isCorrect(question, ["b"]), true);
  assert.equal(isCorrect(question, ["a"]), false);
});

test("upsert is idempotent on the same stem", () => {
  const lib = seedLibrary();
  const before = lib.questions.length;
  const op = {
    op: "question.upsert",
    bank: "计算机网络",
    chapter: "传输层",
    type: "单选",
    stem: "TCP 用什么保证字节按序到达？",
    choices: ["端口号", "序号", "MAC 地址", "DNS TTL"],
    answer: "B",
    explanation: "序号。",
  };
  const once = applyOps(lib, [op]);
  const twice = applyOps(once.library, [op]);
  assert.equal(once.results[0]?.ok, true);
  assert.equal(once.library.questions.length, before + 1);
  assert.equal(twice.library.questions.length, before + 1);
});

test("text import reads a numbered block", () => {
  const ops = textToOps(
    `# 自测\n## 第一章\n1. 二加二等于几？\nA. 3\nB. 4\n答案：B\n解析：基础加法。`,
    "自测",
  );
  const lib = applyOps(seedLibrary(), ops).library;
  const added = lib.questions.find((item) => item.stem.includes("二加二"));
  assert.ok(added);
  assert.equal(isCorrect(added, ["b"]), true);
});

test("blank accepts any listed answer", () => {
  const question: Question = {
    id: "t",
    bankId: "b",
    chapterId: "c",
    type: "blank",
    stem: "协议号",
    choices: [],
    answer: ["89", "八十九"],
    explanation: "",
    difficulty: 1,
    tags: [],
    source: "",
  };
  assert.equal(isCorrect(question, [" 89 "]), true);
  assert.equal(isCorrect(question, ["88"]), false);
});

test("two correct reviews master a wrong item", () => {
  const first = nextWrongState(undefined, "q", false, "t1");
  assert.equal(first?.mastered, false);
  const second = nextWrongState(first ?? undefined, "q", true, "t2");
  assert.equal(second?.mastered, false);
  const third = nextWrongState(second ?? undefined, "q", true, "t3");
  assert.equal(third?.mastered, true);
});

test("json ops import", () => {
  const plan = parseImport(
    JSON.stringify([{ op: "bank.create", name: "临时库", subject: "测试" }]),
    "临时库",
  );
  assert.equal(plan.kind, "ops");
});
