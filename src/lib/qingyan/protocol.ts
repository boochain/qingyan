import { FRAME_GUIDE } from "./frame";
import { TABLE_COLUMNS } from "./rows";
import type { Library } from "./types";

export const PROTOCOL = `青砚 Agent 协议 v2

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
- chapter.rename     { bank, from, to }
- chapter.delete     { bank, name }  里面的题会改到「未分章」
- question.upsert    { bank, subject?, chapter?, type?, stem, choices?, answer, explanation?, difficulty?, tags?, source?, id?, frame? }
  题库不存在时会按名字新建。subject 只在新建、或原科目仍是「未分类」时写入。
- question.bulk      { bank?, items: [ 同 question.upsert 的字段 ] }  一次最多 200 题
- question.delete    { id } 或 { stem }
- wrong.master       { questionId, mastered? }
- favorite.toggle    { questionId }
- note.set           { questionId, text }
- paper.create       { name, bank?, count?, durationMin?, from?: "bank"|"wrong", chapter?, questionIds? }
- paper.delete       { id|name }
- progress.reset     {}  只清做题记录

一次提交最多 200 条操作。本地导入 Excel / Word / 表格 JSON 时，界面会自动分批。

旧题型 type：单选 single、多选 multi、判断 judge、填空 blank、简答 short。
可以省略，程序会根据选项和答案猜测。
选择题 choices 用字符串数组，答案写 "B" 或 "A,C"。
判断题答案写 "对" 或 "错"。
填空答案可写多个可接受值，用 | 分隔。
简答 answer 是关键词数组，答卷里都出现才算对。
同一题库里题干相同会就地更新，重复执行不会复制题目。

新题、怪题不要硬塞进这五种。用 frame。type 写给人看的名字（七选五、点图、日志拆注），frame 写结构。
frame 可以是对象，也可以是 @frame 到 @end 的文本。有 frame 时，判分以 frame 为准。

${FRAME_GUIDE}

要新建一整本题库，优先用表格，不要手写几十条 question.upsert。
表头（顺序可变）：${TABLE_COLUMNS.join(",")}
Excel：工作表名叫「题目」，另有一张「说明」。界面可下载这份模板。
Word：不用表格。结构是：
# 题库名
科目：计算机
## 章节名
1. 题干
A. …
B. …
答案：B
解析：…
难度：1
标签：TCP
题型：单选
框架题把 @frame … @end 放在题目正文里。

Agent 直接提交同一张表的 JSON，应用会建库、分章、写入：
{
  "format": "qingyan.table/1",
  "bank": "计算机网络",
  "subject": "计算机",
  "rows": [
    { "章节": "传输层", "题型": "单选", "题干": "TCP 靠什么重组字节？", "选项A": "端口", "选项B": "序号", "答案": "B", "解析": "序号。", "难度": 1, "标签": "TCP" }
  ]
}
rows 里可以再写「题库」，一行一个库。缺省用外层的 bank / subject。

文本导入仍然可用：# 题库、科目：、## 章节，题目之间空行或新的序号。
每题写「答案：」，可选「解析：」「难度：」「标签：」「题型：」。
带 @frame … @end 的题目可以不写旧式选项；框架内部的行不会被拆成新题。

旧 CSV 表头仍能导入：题库,章节,题型,题干,A,B,C,D,答案,解析,难度,标签
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
    const label = question.frame?.typeName ?? question.type;
    lines.push(`- [${label}] ${bank} / ${chapter}｜${question.stem.slice(0, 60)}`);
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
