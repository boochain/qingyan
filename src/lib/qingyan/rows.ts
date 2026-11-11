export const TABLE_COLUMNS = [
  "题库",
  "科目",
  "章节",
  "题型",
  "题干",
  "选项A",
  "选项B",
  "选项C",
  "选项D",
  "选项E",
  "选项F",
  "答案",
  "解析",
  "难度",
  "标签",
  "框架",
] as const;

const FRAME_SAMPLE = `@frame
type: 术语填空
interaction: blanks
stem: {{1}} 把名字解析成地址
key: 1=DNS|dns
explain 1: 域名系统
@end`;

export const TABLE_SAMPLE: Record<string, string>[] = [
  {
    题库: "计算机网络",
    科目: "计算机",
    章节: "传输层",
    题型: "单选",
    题干: "TCP 靠什么把字节重新排成原来的顺序？",
    选项A: "端口号",
    选项B: "序号",
    选项C: "MAC 地址",
    选项D: "TTL",
    选项E: "",
    选项F: "",
    答案: "B",
    解析: "序号让接收方按发送顺序重组字节流。",
    难度: "1",
    标签: "TCP",
    框架: "",
  },
  {
    题库: "计算机网络",
    科目: "计算机",
    章节: "传输层",
    题型: "判断",
    题干: "三次握手的第二次报文同时带有 SYN 和 ACK。",
    选项A: "",
    选项B: "",
    选项C: "",
    选项D: "",
    选项E: "",
    选项F: "",
    答案: "对",
    解析: "第二次是对连接请求的确认，并带上自己的初始序号。",
    难度: "1",
    标签: "TCP",
    框架: "",
  },
  {
    题库: "计算机网络",
    科目: "计算机",
    章节: "应用层",
    题型: "框架",
    题干: "把协议名称填进空位。",
    选项A: "",
    选项B: "",
    选项C: "",
    选项D: "",
    选项E: "",
    选项F: "",
    答案: "-",
    解析: "",
    难度: "2",
    标签: "DNS",
    框架: FRAME_SAMPLE,
  },
];

export const TABLE_NOTES = [
  "青砚题库模板",
  "题目写在「题目」表。程序认表头，列顺序可以调整，用不到的列留空。",
  "题库：每行可以不同。空着就用导入时所在的题库。同名题库会并进去，不会另建一本。",
  "科目：只在新建题库、或原科目仍是「未分类」时写入。已有科目不会被覆盖。",
  "章节：空着归入「未分章」。",
  "题型：单选、多选、判断、填空、简答、框架。可以空着，由选项和答案推断。",
  "选项按 A 到 F 连续填写，中间不要留空，否则答案字母会对不齐。",
  "答案：单选写 B；多选写 A,C 或 AC；判断写 对 或 错；填空多个可接受答案用 | 分隔。",
  "难度：1 易，2 中，3 难。",
  "标签：多个用 | 或逗号分隔。",
  "框架：新题型、怪题把整段 @frame 到 @end 放在这一列。有内容时以框架为准。这一列在表头里但单元格是空的，会按普通题重新写入。",
  "编号列如果出现，同一张表里重复的编号只认第一次，避免复制行把前一题覆盖掉。",
  "同一题库里题干相同会就地更新，重复导入不会复制题目。",
  "Word 不用表格。用 # 题库名、科目：、## 章节，然后是题干、A. 选项、答案：、解析：。题目之间空一行，或另起序号。",
  'Agent 可以不交文件，直接提交 JSON：{ "format": "qingyan.table/1", "bank": "计算机网络", "subject": "计算机", "rows": [ { "章节": "传输层", "题型": "单选", "题干": "…", "选项A": "…", "选项B": "…", "答案": "B" } ] }',
];

export const WORD_TEMPLATE = `# 计算机网络
科目：计算机

## 传输层

1. TCP 靠什么把字节重新排成原来的顺序？
A. 端口号
B. 序号
C. MAC 地址
D. TTL
答案：B
解析：序号让接收方按发送顺序重组字节流。
难度：1
标签：TCP
题型：单选

2. 三次握手的第二次报文同时带有 SYN 和 ACK。
答案：对
解析：第二次是对连接请求的确认，并带上自己的初始序号。
难度：1
标签：TCP
题型：判断

## 应用层

3. 把协议名称填进空位。
题型：框架
答案：-
难度：2
标签：DNS
${FRAME_SAMPLE}
`;

const ALIAS: Record<string, string> = {
  bank: "bank",
  题库: "bank",
  subject: "subject",
  科目: "subject",
  chapter: "chapter",
  章节: "chapter",
  type: "type",
  题型: "type",
  stem: "stem",
  题干: "stem",
  题目: "stem",
  question: "stem",
  answer: "answer",
  答案: "answer",
  explanation: "explanation",
  解析: "explanation",
  difficulty: "difficulty",
  难度: "difficulty",
  tags: "tags",
  标签: "tags",
  frame: "frame",
  框架: "frame",
  source: "source",
  来源: "source",
  id: "id",
  编号: "id",
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  选项a: "A",
  选项b: "B",
  选项c: "C",
  选项d: "D",
  选项e: "E",
  选项f: "F",
};

export function normalizeRow(raw: Record<string, unknown>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const token = key.replace(/^\uFEFF/, "").replace(/\s+/g, "").toLowerCase();
    const canon = ALIAS[token];
    if (!canon || value == null) continue;
    row[canon] = String(value).trim();
  }
  return row;
}

function coerceFrame(value: string): string {
  let trimmed = value.trim();
  const fenced = /^```[a-zA-Z0-9]*\n([\s\S]*?)\n?```$/.exec(trimmed);
  if (fenced?.[1]) trimmed = fenced[1].trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("@frame")) return trimmed;
  return `@frame\n${trimmed}\n@end`;
}

function choiceSlots(row: Record<string, string>): string[] {
  const slots = ["A", "B", "C", "D", "E", "F"].map((letter) => row[letter] ?? "");
  let end = slots.length;
  while (end > 0 && !slots[end - 1]) end -= 1;
  return slots.slice(0, end);
}

export function rowsToOps(
  rows: Record<string, unknown>[],
  fallback: { bank: string; subject?: string; source?: string },
): unknown[] {
  const ops: unknown[] = [];
  const seenIds = new Set<string>();
  for (const raw of rows) {
    const row = normalizeRow(raw);
    const stem = row.stem || (row.frame ? "框架题" : "");
    if (!stem) continue;
    const op: Record<string, unknown> = {
      op: "question.upsert",
      bank: row.bank || fallback.bank || "导入的题库",
      chapter: row.chapter || "未分章",
      stem,
      choices: choiceSlots(row),
      answer: row.answer || (row.frame ? "-" : ""),
      explanation: row.explanation ?? "",
      tags: row.tags ?? "",
      source: row.source || fallback.source || "表格",
    };
    const subject = row.subject || fallback.subject || "";
    if (subject) op.subject = subject;
    if (row.type) op.type = row.type;
    if (row.difficulty) op.difficulty = row.difficulty;
    if (row.id && !seenIds.has(row.id)) {
      seenIds.add(row.id);
      op.id = row.id;
    }
    if ("frame" in row) op.frame = row.frame ? coerceFrame(row.frame) : "";
    ops.push(op);
  }
  if (!ops.length) throw new Error("没有识别到题目。请确认表头里有「题干」。");
  return ops;
}

export function tableObjectToOps(data: Record<string, unknown>, fallbackBank: string): unknown[] {
  const rows = data.rows;
  if (!Array.isArray(rows)) throw new Error("表格 JSON 需要 rows 数组");
  const bank = typeof data.bank === "string" && data.bank.trim() ? data.bank.trim() : fallbackBank;
  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  return rowsToOps(
    rows.filter((item) => item && typeof item === "object") as Record<string, unknown>[],
    { bank: bank || "导入的题库", subject, source: "agent" },
  );
}
