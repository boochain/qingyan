import type { Library } from "./types";

export const PROTOCOL = `青砚 Agent 协议 v1

题库是一份 JSON 文档（version: 1）。Agent 不直接改数据库，只提交操作数组。
应用内点「执行」会改这台浏览器里的题库。
HTTP 接口不保存任何题目，避免公网实例把题库留在服务器上：

POST /api/qingyan
{ "action": "apply", "library": { ...整库... }, "ops": [ ... ] }
→ { "ok": true, "library": { ...新整库... }, "results": [...] }

GET /api/qingyan 返回这份协议和示例。

操作（每项都要有 op）：
- bank.create        { name, subject?, description? }
- bank.update        { id|bank|name, name?, subject?, description? }
- bank.delete        { id|bank|name }
- chapter.upsert     { bank, name }
- question.upsert    { bank, chapter?, type?, stem, choices?, answer, explanation?, difficulty?, tags?, source?, id? }
  题库不存在时会按名字新建。
- question.bulk      { bank?, items: [ 同 question.upsert 的字段 ] }
- question.delete    { id } 或 { stem }
- wrong.master       { questionId, mastered? }
- favorite.toggle    { questionId }
- note.set           { questionId, text }
- paper.create       { name, bank?, count?, durationMin?, from?: "bank"|"wrong", chapter?, questionIds? }
- paper.delete       { id|name }
- progress.reset     {}  只清做题记录

题型 type：单选 single、多选 multi、判断 judge、填空 blank、简答 short。
可以省略，程序会根据选项和答案猜测。
选择题 choices 用字符串数组，答案写 "B" 或 "A,C"。
判断题答案写 "对" 或 "错"。
填空答案可写多个可接受值，用 | 分隔。
简答 answer 是关键词数组，答卷里都出现才算对。
同一题库里题干相同会就地更新，重复执行不会复制题目。

文本导入：用 # 题库、## 章节，题目之间空行或新的序号。
每题写「答案：」，可选「解析：」「难度：」「标签：」。

CSV 表头：题库,章节,题型,题干,A,B,C,D,答案,解析,难度,标签
`;

export function catalogForAgent(lib: Library): string {
  const lines: string[] = ["现有题库："];
  if (!lib.banks.length) lines.push("（空）");
  for (const bank of lib.banks) {
    const chapters = lib.chapters.filter((chapter) => chapter.bankId === bank.id).map((chapter) => chapter.name);
    const count = lib.questions.filter((question) => question.bankId === bank.id).length;
    lines.push(`- ${bank.name}（id:${bank.id}）${bank.subject}｜${count} 题｜章节：${chapters.join("、") || "无"}`);
  }
  lines.push("", "题目节选（改题时优先用题干匹配，不必写 id）：");
  const slice = lib.questions.slice(0, 40);
  for (const question of slice) {
    const bank = lib.banks.find((item) => item.id === question.bankId)?.name ?? "";
    const chapter = lib.chapters.find((item) => item.id === question.chapterId)?.name ?? "";
    lines.push(`- [${question.type}] ${bank} / ${chapter}｜${question.stem.slice(0, 60)}`);
  }
  if (lib.questions.length > slice.length) {
    lines.push(`……还有 ${lib.questions.length - slice.length} 题未列出`);
  }
  return lines.join("\n").slice(0, 7000);
}

export const OP_EXAMPLE = `[
  {
    "op": "question.upsert",
    "bank": "计算机网络",
    "chapter": "传输层",
    "type": "单选",
    "stem": "TCP 用什么保证字节按序到达？",
    "choices": ["端口号", "序号", "MAC 地址", "DNS TTL"],
    "answer": "B",
    "explanation": "序号让接收方重新排列字节流。",
    "difficulty": 1,
    "tags": ["TCP"]
  }
]`;
