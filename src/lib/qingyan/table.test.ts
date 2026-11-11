import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { docxToPlain, wordTemplateBuffer } from "./docx.ts";
import { libraryToMarkdown, parseImport } from "./io.ts";
import { applyOps } from "./ops.ts";
import { rowsToOps } from "./rows.ts";
import { emptyLibrary } from "./types.ts";
import { xlsxTemplateBuffer, xlsxToOps } from "./xlsx.ts";

test("table rows create a bank, subject, and a frame", () => {
  const ops = rowsToOps(
    [
      { 题库: "计网", 科目: "计算机", 章节: "传输层", 题型: "多选", 题干: "序号用来？", 选项A: "加密", 选项B: "排序", 答案: "AB" },
      { 题库: "计网", 章节: "传输层", 题型: "判断", 题干: "第二次是 SYN+ACK。", 答案: "对" },
      {
        题库: "计网",
        章节: "应用层",
        题型: "框架",
        题干: "填空",
        框架: "@frame\ninteraction: blanks\nstem: {{1}}\nkey: 1=DNS|dns\nexplain 1: 名字\n@end",
      },
    ],
    { bank: "导入的题库", source: "表格" },
  );
  const { library, results } = applyOps(emptyLibrary(), ops);
  assert.equal(results.every((item) => item.ok), true);
  assert.equal(library.banks[0]?.name, "计网");
  assert.equal(library.banks[0]?.subject, "计算机");
  assert.equal(library.questions[0]?.answer.join(","), "a,b");
  assert.equal(library.questions[1]?.type, "judge");
  assert.equal(library.questions[2]?.type, "frame");
  assert.equal(library.questions.length, 3);
});

test("agent table json and markdown subject", () => {
  const plan = parseImport(
    JSON.stringify({
      format: "qingyan.table/1",
      bank: "操作系统",
      subject: "计算机",
      rows: [{ 章节: "进程", 题型: "单选", 题干: "调度看什么？", 选项A: "公平", 选项B: "随机", 答案: "A" }],
    }),
    "导入的题库",
  );
  assert.equal(plan.kind, "ops");
  if (plan.kind !== "ops") return;
  const first = applyOps(emptyLibrary(), plan.ops);
  assert.equal(first.results[0]?.ok, true);
  assert.equal(first.library.banks[0]?.subject, "计算机");

  const text = parseImport("# 离散数学\n科目：数学\n## 逻辑\n1. 前真后假时蕴含为假。\n答案：对\n题型：判断\n", "导入的题库");
  assert.equal(text.kind, "ops");
  if (text.kind !== "ops") return;
  const second = applyOps(emptyLibrary(), text.ops);
  assert.equal(second.library.banks[0]?.name, "离散数学");
  assert.equal(second.library.banks[0]?.subject, "数学");
  assert.equal(second.library.questions[0]?.type, "judge");
});

test("chapter rename and delete moves questions", () => {
  const seeded = applyOps(emptyLibrary(), [
    { op: "question.upsert", bank: "计网", chapter: "传输层", type: "判断", stem: "ACK 表示确认。", answer: "对" },
  ]);
  const renamed = applyOps(seeded.library, [{ op: "chapter.rename", bank: "计网", from: "传输层", to: "传输" }]);
  assert.equal(renamed.results[0]?.ok, true);
  assert.equal(renamed.library.chapters[0]?.name, "传输");
  const removed = applyOps(renamed.library, [{ op: "chapter.delete", bank: "计网", name: "传输" }]);
  assert.equal(removed.results[0]?.ok, true);
  assert.equal(removed.library.chapters.some((chapter) => chapter.name === "未分章"), true);
  assert.equal(removed.library.questions[0]?.chapterId, removed.library.chapters.find((chapter) => chapter.name === "未分章")?.id);
});

test("xlsx and docx templates import back", async () => {
  const xops = await xlsxToOps(await xlsxTemplateBuffer(), "导入的题库");
  const imported = applyOps(emptyLibrary(), xops);
  assert.equal(imported.results.every((item) => item.ok), true);
  assert.equal(imported.library.banks[0]?.name, "计算机网络");
  assert.equal(imported.library.banks[0]?.subject, "计算机");
  assert.equal(imported.library.questions.some((question) => question.type === "frame"), true);

  const plain = await docxToPlain(await wordTemplateBuffer());
  const plan = parseImport(plain, "导入的题库");
  assert.equal(plan.kind, "ops");
  if (plan.kind !== "ops") return;
  const fromWord = applyOps(emptyLibrary(), plan.ops);
  assert.equal(fromWord.results.every((item) => item.ok), true, fromWord.results.map((item) => item.message).join(" | "));
  assert.equal(fromWord.library.questions.length, 3);
  assert.equal(fromWord.library.banks[0]?.subject, "计算机");
});

test("import keeps letters, splits questions, and does not reuse a copied id", () => {
  const inferred = applyOps(
    emptyLibrary(),
    rowsToOps([{ 题干: "哪些对？", 选项A: "甲", 选项B: "乙", 选项C: "丙", 答案: "A C" }], { bank: "库" }),
  );
  assert.equal(inferred.results[0]?.ok, true);
  assert.equal(inferred.library.questions[0]?.type, "multi");
  assert.equal(inferred.library.questions[0]?.answer.join(","), "a,c");

  const gapped = applyOps(
    emptyLibrary(),
    rowsToOps(
      [
        { 题干: "中间空了", 题型: "单选", 选项A: "甲", 选项B: "", 选项C: "丙", 答案: "A" },
        { 题干: "这题是完整的", 题型: "判断", 答案: "对" },
      ],
      { bank: "库" },
    ),
  );
  assert.equal(gapped.results[0]?.ok, false);
  assert.match(gapped.results[0]?.message ?? "", /连续/);
  assert.equal(gapped.results[1]?.ok, true);

  const copied = applyOps(
    emptyLibrary(),
    rowsToOps(
      [
        { 题干: "第一题", 题型: "判断", 答案: "对", 编号: "same" },
        { 题干: "第二题", 题型: "判断", 答案: "错", 编号: "same" },
      ],
      { bank: "库" },
    ),
  );
  assert.equal(copied.library.questions.length, 2);

  const text = parseImport("# 库\n## 章\n第一题没有序号\n答案：对\n题型：判断\n\n第二题也没有序号\n答案：错\n题型：判断\n", "库");
  assert.equal(text.kind, "ops");
  if (text.kind !== "ops") return;
  const split = applyOps(emptyLibrary(), text.ops);
  assert.equal(split.library.questions.length, 2);

  const single = parseImport(JSON.stringify({ op: "bank.create", name: "单独一门" }), "库");
  assert.equal(single.kind, "ops");
  if (single.kind !== "ops") return;
  assert.equal(single.ops.length, 1);
});

test("markdown export of judge and multi imports back", () => {
  const made = applyOps(emptyLibrary(), [
    { op: "question.upsert", bank: "库", subject: "数学", chapter: "逻辑", type: "判断", stem: "蕴含前真后假才为假。", answer: "对" },
    { op: "question.upsert", bank: "库", chapter: "逻辑", type: "多选", stem: "哪些是连接词？", choices: ["与", "或", "在"], answer: "A,B" },
  ]);
  const plan = parseImport(libraryToMarkdown(made.library), "别处");
  assert.equal(plan.kind, "ops");
  if (plan.kind !== "ops") return;
  const back = applyOps(emptyLibrary(), plan.ops);
  assert.equal(back.results.every((item) => item.ok), true, back.results.map((item) => item.message).join(" | "));
  const judge = back.library.questions.find((item) => item.stem.includes("蕴含"));
  const multi = back.library.questions.find((item) => item.stem.includes("连接词"));
  assert.equal(judge?.type, "judge");
  assert.equal(judge?.answer[0], "T");
  assert.equal(multi?.type, "multi");
  assert.equal(multi?.answer.join(","), "a,b");
});

test("an empty frame cell turns a frame question back into a normal one", () => {
  const first = applyOps(
    emptyLibrary(),
    rowsToOps(
      [{ 题库: "库", 题干: "这题会改回判断", 题型: "框架", 框架: "@frame\ninteraction: blanks\nstem: {{1}}\nkey: 1=DNS\n@end" }],
      { bank: "库" },
    ),
  );
  assert.equal(first.library.questions[0]?.type, "frame");
  const second = applyOps(
    first.library,
    rowsToOps([{ 题库: "库", 题干: "这题会改回判断", 题型: "判断", 答案: "对", 框架: "" }], { bank: "库" }),
  );
  assert.equal(second.results[0]?.ok, true, second.results[0]?.message);
  assert.equal(second.library.questions.length, 1);
  assert.equal(second.library.questions[0]?.type, "judge");
  assert.equal(second.library.questions[0]?.frame, undefined);
});

test("word lists and line breaks become choices", async () => {
  const zip = new JSZip();
  zip.file(
    "word/numbering.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>TCP 靠序号</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>端口</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>序号</w:t><w:br/><w:t>答案：B</w:t></w:r></w:p>
</w:body></w:document>`,
  );
  const plain = await docxToPlain(await zip.generateAsync({ type: "arraybuffer" }));
  assert.match(plain, /1\. TCP 靠序号/);
  assert.match(plain, /A\. 端口/);
  assert.match(plain, /B\. 序号\n答案：B/);
  const plan = parseImport(`# 计网\n## 传输层\n${plain}\n题型：单选\n`, "库");
  assert.equal(plan.kind, "ops");
  if (plan.kind !== "ops") return;
  const applied = applyOps(emptyLibrary(), plan.ops);
  assert.equal(applied.results[0]?.ok, true, applied.results[0]?.message);
  assert.equal(applied.library.questions[0]?.answer[0], "b");
});
