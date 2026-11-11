# 青砚 · 给其他 Agent 的说明书

你的工作是**往题库里写题、改题、组卷**。不要改界面，不要假设服务器会记住题库。

人类用的说明在 [README.md](README.md)。这份文件是协议。运行中的全文也可以 `GET /api/qingyan` 拿到，以那份返回为准；下面是你直接开工需要的合同。

## 三条硬规则

1. 题库是一份 `version: 1` 的 JSON 文档，存在**使用者这台浏览器**里。`POST /api/qingyan` **不落库**，只对你提交的文档做运算，把新文档还回来。下一次请求必须带上一次返回的 `library`。
2. 你提交**操作**或**表格**，不要手改 `questions` 数组里的内部 id，除非你是在更新已经存在的那一题。
3. **同一题库、题干完全相同，会就地更新，不会复制。** 想改题就用原题干（或原来的 `id`）。`id` 比题干优先匹配。

一次请求最多 **200** 条操作，请求体最大约 **1.5 MB**。再多就分成多批，每一批都带上上一批返回的 `library`。

## 怎么把题交进去

按这个顺序选，不要从最麻烦的开始：

| 你要做的事 | 用这个 |
|---|---|
| 新建一整本题，几十上百题 | `qingyan.table/1`，或 Markdown / Word / Excel |
| 改一道、加一道、改章节 | 一条或几条 `question.upsert` / `chapter.*` |
| 用户正在用网页 | 让用户在「Agent」页粘贴 JSON 并点执行，或在「题库」页导入文件。HTTP 不会写进他的浏览器 |
| 你自己持有整库 JSON | `POST /api/qingyan`，保存返回的 `library` |

### HTTP

```http
GET /api/qingyan
```

返回 `{ name, protocol, example, note }`。

```http
POST /api/qingyan
Content-Type: application/json
```

应用操作：

```json
{
  "library": { "version": 1, "banks": [], "chapters": [], "questions": [], "attempts": [], "wrongs": [], "favorites": [], "notes": [], "papers": [], "exams": [], "resume": {}, "dailyGoal": 20, "flags": [] },
  "ops": [
    {
      "op": "question.upsert",
      "bank": "计算机网络",
      "subject": "计算机",
      "chapter": "传输层",
      "type": "单选",
      "stem": "TCP 靠什么把字节重新排成原来的顺序？",
      "choices": ["端口号", "序号", "MAC 地址", "TTL"],
      "answer": "B",
      "explanation": "序号让接收方重排字节流。",
      "difficulty": 1,
      "tags": ["TCP"]
    }
  ]
}
```

导入一整段文本（Markdown、CSV、整库 JSON、表格 JSON、单条 op 都可以）：

```json
{
  "action": "import",
  "bank": "导入的题库",
  "text": "# 计算机网络\n科目：计算机\n## 传输层\n1. TCP 面向连接吗？\n答案：对\n",
  "library": { "version": 1, "banks": [], "chapters": [], "questions": [], "attempts": [], "wrongs": [], "favorites": [], "notes": [], "papers": [], "exams": [], "resume": {}, "dailyGoal": 20, "flags": [] }
}
```

成功时：

```json
{ "ok": true, "library": {}, "results": [{ "index": 0, "op": "question.upsert", "ok": true, "message": "已写入", "id": "q_..." }] }
```

某一条失败时，**前面已经成功的操作仍然留在返回的 `library` 里**，`ok` 为 false，`results[i].message` 是原因。不要整批重来，修好失败的那几条再提交。

`library` 可以省略，省略时从空库开始。

## 整库表格（优先）

不要为了 50 道题写 50 条 `question.upsert`。用一张表。

```json
{
  "format": "qingyan.table/1",
  "bank": "计算机网络",
  "subject": "计算机",
  "rows": [
    {
      "章节": "传输层",
      "题型": "单选",
      "题干": "TCP 靠什么重组字节？",
      "选项A": "端口",
      "选项B": "序号",
      "答案": "B",
      "解析": "序号。",
      "难度": "1",
      "标签": "TCP"
    }
  ]
}
```

列名（顺序可变，空列可以不写）：

`题库, 科目, 章节, 题型, 题干, 选项A, 选项B, 选项C, 选项D, 选项E, 选项F, 答案, 解析, 难度, 标签, 框架`

也认这些别名：`A`–`F`、英文 `stem` / `answer` / `chapter`、`编号` 或 `id`、`来源`。

规则：

- 一行可以自带「题库」，否则用外层 `bank` / `subject`。
- 难度只接受 `1` `2` `3`。空的当成 `2`。
- 标签用逗号、顿号或 `|` 分开。
- 多选答案写成 `A,C`、`AC` 或 `A C`。选项字母按位置对应 A、B、C，不是按文字内容。
- 选项必须从 A 连续填，中间不能空一格。
- 判断题答案写 `对` 或 `错`（也认 正确/错误/true/false/yes/no/√/×），并且**不要写选项**。
- 同一份文件里「编号」重复时，只有第一行保留这个 id。
- 「框架」单元格空字符串会**清掉**这道题原来的框架。列不出现则不动旧框架。
- CSV 带不走框架。框架用 Markdown、JSON 或 Excel 的「框架」列。

Excel：工作表必须叫「题目」。名叫「说明」的表会被跳过。界面可以下载模板。

Word / Markdown：

```markdown
# 计算机网络
科目：计算机

## 传输层

1. TCP 是否面向连接？
答案：对
解析：三次握手建立连接。
难度：1
标签：TCP
题型：判断
```

选择题把 `A.` `B.` 写在题干和「答案：」之间。题目之间用空行分开；空行只有在这一块里已经出现过「答案：」或 `@end` 之后才会切开下一题。

## 操作

每条都要有 `op`。

| op | 字段 | 说明 |
|---|---|---|
| `bank.create` | `name`, `subject?`, `description?` | 同名题库会被拒绝 |
| `bank.update` | `id` 或 `bank` 或 `name`，以及要改的 `name?` `subject?` `description?` | 科目留空会变成「未分类」 |
| `bank.delete` | `id` 或 `bank` 或 `name` | 连题目一起删 |
| `chapter.upsert` | `bank`, `name`, `order?` | 没有就新建 |
| `chapter.rename` | `bank`, `from`（名字或 id）, `to` | |
| `chapter.delete` | `bank`, `chapter` 或 `name` 或 `id` | 里面的题改到「未分章」。未分章里还有题时不能删未分章 |
| `question.upsert` | 见下 | 题库不存在会按名字建出来 |
| `question.bulk` | `bank?`, `items`（最多 200） | 每项字段同 upsert |
| `question.delete` | `id` 或 `stem` | |
| `wrong.master` | `questionId`, `mastered?` | |
| `favorite.toggle` | `questionId` | |
| `note.set` | `questionId`, `text` | |
| `paper.create` | `name`, `bank?`, `count?`, `durationMin?`, `from?`（`bank` 或 `wrong`）, `chapter?`, `questionIds?` | |
| `paper.delete` | `id` 或 `name` | |
| `progress.reset` | 无 | 只清做题记录，题目还在 |

`question.upsert` 字段：

`bank`, `subject?`, `chapter?`, `type?`, `stem`, `choices?`, `answer`, `explanation?`, `difficulty?`, `tags?`, `source?`, `id?`, `frame?`

- `subject` 只在题库刚被这条操作创建、或原科目仍是「未分类」时写入。
- `type` 可省略。有选项并且答案是一个字母，当成单选；多个字母当多选。不要靠题干里出现「错」字去猜判断题。
- 旧题型只这五种：`single` 单选、`multi` 多选、`judge` 判断、`blank` 填空、`short` 简答。中文「单选」等也可以。
- 选择题 `choices` 用字符串数组，或 `{ "id", "text" }`（要保住已有选项 id 时用对象）。答案写 `"B"` 或 `"A,C"`。
- 判断题答案写 `"对"` 或 `"错"`。
- 填空的多个可接受答案用 `|`。简答的 `answer` 是关键词，答卷里都出现才算对。
- `frame` 可以是对象，或 `@frame` … `@end` 文本。只要带了 frame，这题就按框架判分，`type` 会被改成 `frame`。
- `frame: ""` 显式清空框架。不写 `frame` 字段则保留原来的。

## 怪题：框架，不要硬塞进五种题

七选五、点图、排序、连线、分类、矩阵、改错、材料题，全部用框架。`type` 写给人看的名字，结构写在 `frame`。

```text
@frame
type: 七选五
interaction: slots
unique: yes
stem: TCP 用{{1}}重排字节，用{{2}}通告接收能力。
opt A: 序号
opt B: 窗口
opt C: MAC 地址
key: 1=A ; 2=B
explain 1: 序号用于重排与重传。
explain 2: 窗口通告对方还能接收多少。
@end
```

`interaction` 只能是：

`choice` `judge` `blanks` `numeric` `slots` `order` `pairs` `bins` `matrix` `hotspot` `highlight` `patch` `free` `custom` `material`

约定：

- `choice`：`select: one` 或 `many`。`opt A: 文字`。
- `judge`：不写选项时默认 T 正确、F 错误。`key: T`。
- `blanks`：题干 `{{1}}`。`key: 1=答案|别名`。
- `numeric`：`tolerance: 0.01`。`key: 62`。
- `slots`：`unique: yes` 表示选项不能重复用。
- `order`：`item s1: 第一步`。`key` 按正确顺序写 id：`key: s1 ; s2 ; s3`。
- `pairs`：`left 甲: 文字`，`right 1: 文字`。`key: 甲>1`。
- `bins`：`bin live: 生物`，`item fish: 鱼`。`key: fish=live`。
- `matrix`：`row r1:`，`col T:`。`key: r1=T`。
- `hotspot`：只在必须在图上作答时用。`region sa: 0.31,0.70,0.08`，x、y、r 都是相对整张图的 0 到 1。
- `highlight`：题干里 `[[bad|这段]]`。`key` 写 span 的 id。
- `patch`：`[[a|错字]]`。`key: a=正确文字`。
- `free`：`keywords: 合法 ; 业务`。`keywordMode: all` 或 `ratio`。
- `custom`：`field time.kind: text`，`field time.prompt: 问什么`。`key: time=03:11`。
- `material`：一篇材料带几道小题。`sub s1.interaction: choice`，小题不能再套材料。

多条 `key` 用「空格 + 分号 + 空格」分开，或另起一行 `key+:`。`|` 只用来分隔同一空的别名。

解析的 `explain` 后面跟 id（空号、选项、区域、span、field，或 `小题id@id`）。`explain *` 是整题。

图和声音都是可选项。没有就不要写 `img`。学生打开图之后可以滚轮、捏合缩放，拖动不受屏幕边缘限制。

判分对错题本是整题对或错。界面会把每一空的对错展示出来。你不需要自己算分。

## 不要做的事

- 不要把地图、看图说话做成必答题。图只是附属，热点题只在答案就在图上时使用。
- 不要为了“再导入一次”改题干。题干变了就会变成新题。
- 不要一次提交超过 200 条操作。本地界面导入会自己分批，HTTP 不会。
- 不要指望 POST 之后用户的浏览器自动出现这些题。把返回的 `library` 交给用户导入，或让用户在 Agent 页执行你写的 JSON。
- 不要在选项中间留空。`A`、`C` 有字而 `B` 空着会被拒绝。
- 不要把框架题只写成普通单选。新题型写 `@frame`。

## 源码位置

协议字符串和示例：`src/lib/qingyan/protocol.ts`  
框架语法：`src/lib/qingyan/frame.ts` 里的 `FRAME_GUIDE`  
表头：`src/lib/qingyan/rows.ts` 的 `TABLE_COLUMNS`  
HTTP：`src/routes/api/qingyan.ts`  
判分与导入测试：`src/lib/qingyan/*.test.ts`
