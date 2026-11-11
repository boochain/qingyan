export const INTERACTIONS = [
  "choice",
  "judge",
  "blanks",
  "numeric",
  "slots",
  "order",
  "pairs",
  "bins",
  "matrix",
  "hotspot",
  "highlight",
  "patch",
  "free",
  "custom",
  "material",
] as const;

export type Interaction = (typeof INTERACTIONS)[number];

export interface FrameOpt {
  id: string;
  text: string;
  image?: string;
  alt?: string;
}

export interface FrameRegion {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface FrameField {
  id: string;
  kind: "text" | "choice" | "multi" | "number";
  prompt: string;
  options: FrameOpt[];
}

export interface ExplainBit {
  target: string;
  text: string;
  image?: string;
  alt?: string;
  credit?: string;
}

export interface ItemFrame {
  v: 1;
  id: string;
  typeName: string;
  interaction: Interaction;
  select: "one" | "many";
  unique: boolean;
  tolerance: number;
  keywordMode: "all" | "ratio";
  keywordRatio: number;
  keywords: string[];
  stem: string;
  stemCode: boolean;
  image: string;
  imageAlt: string;
  imageCredit: string;
  audio: string;
  audioTitle: string;
  audioCredit: string;
  options: FrameOpt[];
  left: FrameOpt[];
  right: FrameOpt[];
  rows: FrameOpt[];
  cols: FrameOpt[];
  items: FrameOpt[];
  bins: FrameOpt[];
  regions: FrameRegion[];
  fields: FrameField[];
  blankOptions: Record<string, FrameOpt[]>;
  key: string[];
  explain: ExplainBit[];
  subs: ItemFrame[];
}

export interface GradePart {
  target: string;
  ok: boolean;
  expect: string;
  got: string;
}

export interface GradeReport {
  correct: boolean;
  parts: GradePart[];
}

const INTERACTION_SET = new Set<string>(INTERACTIONS);

const TYPE_NAMES: Record<Interaction, string> = {
  choice: "选择",
  judge: "判断",
  blanks: "填空",
  numeric: "数值",
  slots: "选词",
  order: "排序",
  pairs: "连线",
  bins: "分类",
  matrix: "矩阵",
  hotspot: "点图",
  highlight: "划线",
  patch: "改错",
  free: "简答",
  custom: "自定义",
  material: "材料",
};

export const FRAME_GUIDE = `题型框架 qingyan.frame/1
程序和 Agent 读同一份字段。question.upsert 的 frame 可以是对象，也可以是下面这种文本。

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

interaction 只能是这些（对不上时拆进 material 或 custom）：
choice   单选、多选。select: one 或 many。opt A: 文字。选项附图可选：opt A.img: 地址
judge    判断。不写 opt 时默认 T 正确、F 错误。key: T
blanks   填空。题干用 {{1}}。key: 1=答案|别名
numeric  数值。tolerance: 0.01。key: 62
slots    完形、七选五。unique: yes 表示选项不能重复用。
         某一空单独的选项：blank 1.opt A: 文字。key: 1=A
order    排序。item s1: 第一步。key 按正确顺序写 id：key: s1 ; s2 ; s3
pairs    连线。left 甲: 文字。right 1: 文字。key: 甲>1
bins     分类。bin live: 生物。item fish: 鱼。key: fish=live
matrix   矩阵。row r1: 一句话。col T: 对。select 默认 one。key: r1=T
hotspot  可选。只在必须在图上作答时使用，不要用来做无关的看图题。
         img: 地址。region sa: 0.31,0.70,0.08
         x、y、r 都是相对整张图的 0 到 1，r 用同一套归一化距离。
         select: one 或 many。key: sa。点在圆内即算点中该区。
highlight 把 [[bad|这段]] 点出来。key 写 span 的 id
patch    改错，同样用 [[a|错字]]。key: a=正确文字
free     简答。keywords: 合法 ; 业务。keywordMode: all 或 ratio。keywordRatio: 0.6
         key 写一份完整参考答案，关键词都要出现在里面
custom   对不上现成交互的新题。field time.kind: text 或 choice 或 multi 或 number
         field time.prompt: 问什么。field act.opt deny: 拒绝。key: time=03:11 ; act=deny
material 一篇材料带几道小题，小题不能再套材料：
         sub s1.interaction: choice
         sub s1.type: 细节
         sub s1.stem: 问什么
         sub s1.opt A: …
         sub s1.key: A
         sub s1.explain A: 这空为什么

附图和声音都是可选项，没有就不要写：
img: 地址    img.alt:    img.credit: 署名和协议
audio: 地址  audio.title:  audio.credit:
explain 1.img: 地址   只给这一条解析配图
题干里也可以写 ![说明](地址) 和 [[audio:地址|标题]]
有图时，学生可以打开查看：滚轮或捏合缩放，拖动不受屏幕边缘限制。

key 的多条用「空格 + 分号 + 空格」分开，或另起一行 key+:
填空的多个可接受答案用竖线，竖线不能用来分隔不同的空。

判分时学生答案的编码（Agent 不必手写，界面会生成）：
choice / judge / highlight / order：id 列表，order 的顺序就是作答顺序
hotspot：点到的区域 id，或归一化坐标 x,y
blanks / slots / bins / matrix / patch / custom：id=值
pairs：左id>右id
numeric：一个数字
free：整段文字放在同一项
material：小题id@上面的编码，例如 s1@A 、s2@1=合法

解析的 target 必须用上面的 id（空号、选项、区域、span、field、小题里的 id）。
reveal 之后点某一项，会滚到对应的解析；写错的那一项会被标出来。`;

interface Draft {
  id: string;
  typeName: string;
  interaction: string;
  select: "one" | "many";
  unique: boolean;
  tolerance: number;
  keywordMode: "all" | "ratio";
  keywordRatio: number;
  keywords: string[];
  stem: string[];
  stemCode: boolean;
  image: string;
  imageAlt: string;
  imageCredit: string;
  audio: string;
  audioTitle: string;
  audioCredit: string;
  options: FrameOpt[];
  left: FrameOpt[];
  right: FrameOpt[];
  rows: FrameOpt[];
  cols: FrameOpt[];
  items: FrameOpt[];
  bins: FrameOpt[];
  regions: FrameRegion[];
  fields: FrameField[];
  blankOptions: Record<string, FrameOpt[]>;
  key: string[];
  explain: ExplainBit[];
  subs: Draft[];
}

function blankDraft(): Draft {
  return {
    id: "",
    typeName: "",
    interaction: "",
    select: "one",
    unique: false,
    tolerance: 0,
    keywordMode: "all",
    keywordRatio: 0.6,
    keywords: [],
    stem: [],
    stemCode: false,
    image: "",
    imageAlt: "",
    imageCredit: "",
    audio: "",
    audioTitle: "",
    audioCredit: "",
    options: [],
    left: [],
    right: [],
    rows: [],
    cols: [],
    items: [],
    bins: [],
    regions: [],
    fields: [],
    blankOptions: {},
    key: [],
    explain: [],
    subs: [],
  };
}

function yes(value: string): boolean {
  return /^(yes|true|1|y|是|要)$/i.test(value.trim());
}

function splitTokens(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.includes(" ; ") || trimmed.includes("；")) {
    return trimmed.split(/\s*;\s*|；+/).map((item) => item.trim()).filter(Boolean);
  }
  if (trimmed.includes("=") || trimmed.includes(">")) return [trimmed];
  if (/[,，]/.test(trimmed)) return trimmed.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  return [trimmed];
}

function upsertOpt(list: FrameOpt[], id: string, patch: Partial<FrameOpt>): void {
  const found = list.find((item) => item.id === id);
  if (found) Object.assign(found, patch);
  else list.push({ id, text: "", ...patch });
}

function explainOf(draft: Draft, target: string): ExplainBit {
  const found = draft.explain.find((item) => item.target === target);
  if (found) return found;
  const created: ExplainBit = { target, text: "" };
  draft.explain.push(created);
  return created;
}

function applyLine(draft: Draft, key: string, value: string): void {
  const sub = /^sub\s+(\S+)\.(.+)$/.exec(key);
  if (sub) {
    const id = sub[1]!;
    let child = draft.subs.find((item) => item.id === id);
    if (!child) {
      child = blankDraft();
      child.id = id;
      draft.subs.push(child);
    }
    applyLine(child, sub[2]!, value);
    return;
  }
  if (key === "type" || key === "typeName") {
    draft.typeName = value.trim();
    return;
  }
  if (key === "interaction") {
    draft.interaction = value.trim();
    return;
  }
  if (key === "select") {
    draft.select = /many|多/.test(value) ? "many" : "one";
    return;
  }
  if (key === "unique") {
    draft.unique = yes(value);
    return;
  }
  if (key === "tolerance") {
    draft.tolerance = Number(value);
    return;
  }
  if (key === "keywordMode") {
    draft.keywordMode = /ratio|比例/.test(value) ? "ratio" : "all";
    return;
  }
  if (key === "keywordRatio") {
    draft.keywordRatio = Number(value);
    return;
  }
  if (key === "keywords") {
    draft.keywords.push(...splitTokens(value));
    return;
  }
  if (key === "stem") {
    draft.stem = value ? [value] : [];
    return;
  }
  if (key === "stem+") {
    draft.stem.push(value);
    return;
  }
  if (key === "stemCode") {
    draft.stemCode = yes(value);
    return;
  }
  if (key === "img" || key === "image") {
    draft.image = value.trim();
    return;
  }
  if (key === "img.alt" || key === "image.alt") {
    draft.imageAlt = value.trim();
    return;
  }
  if (key === "img.credit" || key === "image.credit") {
    draft.imageCredit = value.trim();
    return;
  }
  if (key === "audio") {
    draft.audio = value.trim();
    return;
  }
  if (key === "audio.title") {
    draft.audioTitle = value.trim();
    return;
  }
  if (key === "audio.credit") {
    draft.audioCredit = value.trim();
    return;
  }
  if (key === "key") {
    draft.key.push(...splitTokens(value));
    return;
  }
  if (key === "key+") {
    if (value.trim()) draft.key.push(value.trim());
    return;
  }
  const opt = /^(opt|left|right|row|col|item|bin)\s+(\S+?)(?:\.(img|alt))?$/.exec(key);
  if (opt) {
    const bucket =
      opt[1] === "opt"
        ? draft.options
        : opt[1] === "left"
          ? draft.left
          : opt[1] === "right"
            ? draft.right
            : opt[1] === "row"
              ? draft.rows
              : opt[1] === "col"
                ? draft.cols
                : opt[1] === "item"
                  ? draft.items
                  : draft.bins;
    const id = opt[2]!;
    if (opt[3] === "img") upsertOpt(bucket, id, { image: value.trim() });
    else if (opt[3] === "alt") upsertOpt(bucket, id, { alt: value.trim() });
    else upsertOpt(bucket, id, { text: value.trim() });
    return;
  }
  const region = /^region\s+(\S+)$/.exec(key);
  if (region) {
    const nums = value.split(/[,，\s]+/).map(Number).filter((n) => Number.isFinite(n));
    if (nums.length < 3) throw new Error(`区域 ${region[1]} 要写成 x,y,r`);
    draft.regions.push({ id: region[1]!, x: nums[0]!, y: nums[1]!, r: nums[2]! });
    return;
  }
  const blankOpt = /^blank\s+(\S+)\.opt\s+(\S+)$/.exec(key);
  if (blankOpt) {
    const list = draft.blankOptions[blankOpt[1]!] ?? [];
    draft.blankOptions[blankOpt[1]!] = list;
    upsertOpt(list, blankOpt[2]!, { text: value.trim() });
    return;
  }
  const fieldKind = /^field\s+(\S+)\.kind$/.exec(key);
  if (fieldKind) {
    const kind = value.trim() as FrameField["kind"];
    if (!["text", "choice", "multi", "number"].includes(kind)) throw new Error(`field ${fieldKind[1]} 的 kind 不认识`);
    let field = draft.fields.find((item) => item.id === fieldKind[1]);
    if (!field) {
      field = { id: fieldKind[1]!, kind, prompt: "", options: [] };
      draft.fields.push(field);
    }
    field.kind = kind;
    return;
  }
  const fieldPrompt = /^field\s+(\S+)\.prompt$/.exec(key);
  if (fieldPrompt) {
    let field = draft.fields.find((item) => item.id === fieldPrompt[1]);
    if (!field) {
      field = { id: fieldPrompt[1]!, kind: "text", prompt: "", options: [] };
      draft.fields.push(field);
    }
    field.prompt = value.trim();
    return;
  }
  const fieldOpt = /^field\s+(\S+)\.opt\s+(\S+)$/.exec(key);
  if (fieldOpt) {
    let field = draft.fields.find((item) => item.id === fieldOpt[1]);
    if (!field) {
      field = { id: fieldOpt[1]!, kind: "choice", prompt: "", options: [] };
      draft.fields.push(field);
    }
    upsertOpt(field.options, fieldOpt[2]!, { text: value.trim() });
    return;
  }
  const explainImg = /^explain\s+(\S+)\.(img|alt|credit)$/.exec(key);
  if (explainImg) {
    const bit = explainOf(draft, explainImg[1]!);
    if (explainImg[2] === "img") bit.image = value.trim();
    else if (explainImg[2] === "alt") bit.alt = value.trim();
    else bit.credit = value.trim();
    return;
  }
  const explain = /^explain\s+(\S+?)(\+)?$/.exec(key);
  if (explain) {
    const bit = explainOf(draft, explain[1]!);
    bit.text = bit.text && explain[2] ? `${bit.text}\n${value}` : value.trim() ? value : bit.text;
    if (explain[2] && bit.text.endsWith("\n")) bit.text = bit.text.replace(/\n$/, "");
    return;
  }
  throw new Error(`框架里不认识「${key}」`);
}

function finish(draft: Draft, nested: boolean): ItemFrame {
  const interaction = draft.interaction.trim() as Interaction;
  if (!INTERACTION_SET.has(interaction)) {
    throw new Error(`interaction 必须是 ${INTERACTIONS.join(" / ")}`);
  }
  if (nested && interaction === "material") throw new Error("材料题里的小题不能再套材料");
  if (interaction === "judge" && draft.options.length === 0) {
    draft.options = [
      { id: "T", text: "正确" },
      { id: "F", text: "错误" },
    ];
  }
  if (interaction === "material") {
    if (!draft.subs.length) throw new Error("材料题至少要有一道 sub");
  } else if (interaction === "free") {
    if (!draft.keywords.length && !draft.key.length) throw new Error("简答要有 keywords 或 key");
  } else if (!draft.key.length) throw new Error("框架缺少 key");
  if (interaction === "hotspot" && !draft.image) throw new Error("点图题要有 img");
  if (interaction === "hotspot" && !draft.regions.length) throw new Error("点图题要有 region");
  const frame: ItemFrame = {
    v: 1,
    id: draft.id,
    typeName: draft.typeName || TYPE_NAMES[interaction],
    interaction,
    select: draft.select,
    unique: draft.unique,
    tolerance: Number.isFinite(draft.tolerance) ? draft.tolerance : 0,
    keywordMode: draft.keywordMode,
    keywordRatio: Number.isFinite(draft.keywordRatio) ? draft.keywordRatio : 0.6,
    keywords: draft.keywords,
    stem: draft.stem.join("\n").trim(),
    stemCode: draft.stemCode,
    image: draft.image,
    imageAlt: draft.imageAlt,
    imageCredit: draft.imageCredit,
    audio: draft.audio,
    audioTitle: draft.audioTitle,
    audioCredit: draft.audioCredit,
    options: draft.options,
    left: draft.left,
    right: draft.right,
    rows: draft.rows,
    cols: draft.cols,
    items: draft.items,
    bins: draft.bins,
    regions: draft.regions,
    fields: draft.fields,
    blankOptions: draft.blankOptions,
    key: draft.key,
    explain: draft.explain.filter((bit) => bit.text || bit.image),
    subs: draft.subs.map((sub) => finish(sub, true)),
  };
  return frame;
}

export function parseFrameText(source: string): ItemFrame {
  let body = source.replace(/^\uFEFF/, "").trim();
  if (body.startsWith("@frame")) body = body.replace(/^@frame[^\n]*\n?/, "");
  body = body.replace(/\n?@end\s*$/, "");
  const draft = blankDraft();
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^(.*?)\s*[:：]\s*(.*)$/.exec(line);
    if (!match) throw new Error(`框架行缺少冒号：${line.slice(0, 40)}`);
    applyLine(draft, match[1]!.trim(), match[2] ?? "");
  }
  return finish(draft, false);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} 必须是对象`);
  return value as Record<string, unknown>;
}

function optList(value: unknown): FrameOpt[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") return { id: String.fromCharCode(65 + index), text: item };
    const record = asRecord(item, "选项");
    return {
      id: String(record.id ?? String.fromCharCode(65 + index)),
      text: String(record.text ?? ""),
      image: record.image ? String(record.image) : undefined,
      alt: record.alt ? String(record.alt) : undefined,
    };
  });
}

export function frameFromUnknown(value: unknown): ItemFrame {
  if (typeof value === "string") return parseFrameText(value);
  const record = asRecord(value, "frame");
  if (typeof record.interaction !== "string") {
    throw new Error("frame 缺少 interaction。文本框架请以 @frame 开头。");
  }
  const draft = blankDraft();
  draft.typeName = String(record.typeName ?? record.type ?? "");
  draft.interaction = record.interaction;
  draft.select = record.select === "many" ? "many" : "one";
  draft.unique = Boolean(record.unique);
  draft.tolerance = Number(record.tolerance ?? 0);
  draft.keywordMode = record.keywordMode === "ratio" ? "ratio" : "all";
  draft.keywordRatio = Number(record.keywordRatio ?? 0.6);
  draft.keywords = Array.isArray(record.keywords) ? record.keywords.map(String) : [];
  draft.stem = [String(record.stem ?? "")];
  draft.stemCode = Boolean(record.stemCode);
  draft.image = String(record.image ?? "");
  draft.imageAlt = String(record.imageAlt ?? "");
  draft.imageCredit = String(record.imageCredit ?? "");
  draft.audio = String(record.audio ?? "");
  draft.audioTitle = String(record.audioTitle ?? "");
  draft.audioCredit = String(record.audioCredit ?? "");
  draft.options = optList(record.options);
  draft.left = optList(record.left);
  draft.right = optList(record.right);
  draft.rows = optList(record.rows);
  draft.cols = optList(record.cols);
  draft.items = optList(record.items);
  draft.bins = optList(record.bins);
  draft.regions = Array.isArray(record.regions)
    ? record.regions.map((item) => {
        const region = asRecord(item, "region");
        return { id: String(region.id), x: Number(region.x), y: Number(region.y), r: Number(region.r) };
      })
    : [];
  draft.fields = Array.isArray(record.fields)
    ? record.fields.map((item) => {
        const field = asRecord(item, "field");
        return {
          id: String(field.id),
          kind: String(field.kind ?? "text") as FrameField["kind"],
          prompt: String(field.prompt ?? ""),
          options: optList(field.options),
        };
      })
    : [];
  if (record.blankOptions && typeof record.blankOptions === "object") {
    for (const [id, options] of Object.entries(record.blankOptions as Record<string, unknown>)) {
      draft.blankOptions[id] = optList(options);
    }
  }
  draft.key = Array.isArray(record.key) ? record.key.map(String) : splitTokens(String(record.key ?? ""));
  draft.explain = Array.isArray(record.explain)
    ? record.explain.map((item) => {
        const bit = asRecord(item, "explain");
        return {
          target: String(bit.target ?? "*"),
          text: String(bit.text ?? ""),
          image: bit.image ? String(bit.image) : undefined,
          alt: bit.alt ? String(bit.alt) : undefined,
          credit: bit.credit ? String(bit.credit) : undefined,
        };
      })
    : [];
  if (Array.isArray(record.subs) && record.subs.length) {
    draft.subs = record.subs.map((_, index) => {
      const child = blankDraft();
      child.id = `tmp${index}`;
      child.interaction = "choice";
      child.key = ["A"];
      child.options = [{ id: "A", text: "占位" }];
      return child;
    });
  }
  const frame = finish(draft, false);
  if (Array.isArray(record.subs)) {
    frame.subs = record.subs.map((item) => {
      const subRecord = asRecord(item, "sub");
      const sub = frameFromUnknown(subRecord);
      sub.id = String(subRecord.id ?? "");
      if (!sub.id) throw new Error("小题缺少 id");
      if (sub.interaction === "material") throw new Error("材料题里的小题不能再套材料");
      return sub;
    });
    if (!frame.subs.length) throw new Error("材料题至少要有一道 sub");
  }
  return frame;
}

export function normalizeLoose(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function firstAlt(token: string): string {
  const eq = token.indexOf("=");
  if (eq < 0 || token.includes(">")) return token;
  const id = token.slice(0, eq);
  const first = token.slice(eq + 1).split("|")[0] ?? "";
  return `${id}=${first}`;
}

export function canonicalChosen(frame: ItemFrame): string[] {
  if (frame.interaction === "material") {
    return frame.subs.flatMap((sub) => canonicalChosen(sub).map((token) => `${sub.id}@${token}`));
  }
  if (frame.interaction === "free") {
    const sample = frame.key[0] ?? frame.keywords.join("、");
    return sample ? [sample] : [];
  }
  return frame.key.map(firstAlt);
}

export function summarizeExplain(frame: ItemFrame): string {
  const bits = [...frame.explain];
  for (const sub of frame.subs) bits.push(...sub.explain);
  return bits
    .map((bit) => bit.text)
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

function setReport(key: string[], chosen: string[], label: (id: string) => string): GradeReport {
  const keySet = new Set(key);
  const gotSet = new Set(chosen);
  const parts: GradePart[] = [];
  for (const id of [...keySet, ...gotSet]) {
    if (keySet.has(id) && gotSet.has(id)) continue;
    parts.push({
      target: id,
      ok: false,
      expect: keySet.has(id) ? label(id) : "不选",
      got: gotSet.has(id) ? "选了" : "没选",
    });
  }
  for (const id of keySet) {
    if (gotSet.has(id)) parts.push({ target: id, ok: true, expect: label(id), got: "选了" });
  }
  const correct = keySet.size === gotSet.size && [...keySet].every((id) => gotSet.has(id));
  return { correct, parts };
}

function tokenMap(tokens: string[], sep: "=" | ">"): Map<string, string> {
  const map = new Map<string, string>();
  for (const token of tokens) {
    const index = token.indexOf(sep);
    if (index < 0) continue;
    map.set(token.slice(0, index).trim(), token.slice(index + 1).trim());
  }
  return map;
}

function looseEq(expect: string, got: string): boolean {
  const alts = expect.split("|").map((item) => normalizeLoose(item)).filter(Boolean);
  const value = normalizeLoose(got);
  return alts.includes(value);
}

function pairReport(frame: ItemFrame, chosen: string[]): GradeReport {
  const key = tokenMap(frame.key, ">");
  const got = tokenMap(chosen, ">");
  const parts: GradePart[] = [];
  const ids = new Set([...key.keys(), ...got.keys()]);
  let correct = key.size === got.size && key.size > 0;
  for (const id of ids) {
    const expect = key.get(id) ?? "";
    const value = got.get(id) ?? "";
    const ok = Boolean(expect) && expect === value;
    if (!ok) correct = false;
    parts.push({ target: id, ok, expect: expect || "不连", got: value || "没连" });
  }
  if (got.size !== key.size) correct = false;
  return { correct, parts };
}

function assignReport(frame: ItemFrame, chosen: string[]): GradeReport {
  const key = tokenMap(frame.key, "=");
  const got = tokenMap(chosen, "=");
  const parts: GradePart[] = [];
  let correct = key.size > 0 && got.size === key.size;
  for (const [id, expect] of key) {
    const value = got.get(id) ?? "";
    const ok = value !== "" && looseEq(expect, value);
    if (!ok) correct = false;
    parts.push({ target: id, ok, expect: expect.split("|")[0] ?? expect, got: value || "空" });
  }
  for (const id of got.keys()) {
    if (!key.has(id)) {
      correct = false;
      parts.push({ target: id, ok: false, expect: "不填", got: got.get(id) ?? "" });
    }
  }
  return { correct, parts };
}

function numericValue(token: string | undefined): number {
  if (!token) return Number.NaN;
  const raw = token.includes("=") ? token.slice(token.indexOf("=") + 1) : token;
  return Number(raw.replace(/,/g, "").trim());
}

function pointOf(token: string): { x: number; y: number } | null {
  const match = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(token.trim());
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

export function regionHit(region: FrameRegion, x: number, y: number): boolean {
  return Math.hypot(x - region.x, y - region.y) <= region.r + 1e-6;
}

function gradeHotspot(frame: ItemFrame, chosen: string[]): GradeReport {
  const points = chosen.map(pointOf).filter((item): item is { x: number; y: number } => Boolean(item));
  if (!points.length) return setReport(frame.key, chosen, (id) => id);
  const hits: string[] = [];
  for (const point of points) {
    const region = frame.regions.find((item) => regionHit(item, point.x, point.y));
    hits.push(region?.id ?? "*");
  }
  if (frame.select === "one") {
    const hit = hits[0] ?? "*";
    const ok = points.length === 1 && frame.key.includes(hit);
    return {
      correct: ok,
      parts: [{
        target: hit,
        ok,
        expect: frame.key.join("、"),
        got: hit === "*" ? "区域外" : hit,
      }],
    };
  }
  const need = new Set(frame.key);
  const got = new Set(hits.filter((id) => id !== "*"));
  let correct = hits.every((id) => need.has(id)) && [...need].every((id) => got.has(id));
  if (!points.length) correct = false;
  const extras: GradePart[] = [];
  for (const id of hits) {
    if (id === "*" || !need.has(id)) extras.push({ target: id, ok: false, expect: "不点", got: id === "*" ? "区域外" : id });
  }
  const required: GradePart[] = [];
  for (const id of need) {
    required.push({ target: id, ok: got.has(id), expect: id, got: got.has(id) ? "点中" : "没点" });
  }
  return { correct, parts: [...extras, ...required] };
}

function gradeFree(frame: ItemFrame, chosen: string[]): GradeReport {
  const text = normalizeLoose(chosen.join(" "));
  const words = frame.keywords.length ? frame.keywords : [];
  if (!words.length) {
    const expect = normalizeLoose(frame.key[0] ?? "");
    const ok = Boolean(text) && text === expect;
    return { correct: ok, parts: [{ target: "*", ok, expect: frame.key[0] ?? "", got: chosen[0] ?? "" }] };
  }
  const parts = words.map((word) => {
    const ok = text.includes(normalizeLoose(word));
    return { target: word, ok, expect: word, got: ok ? "提到了" : "没提到" };
  });
  const hit = parts.filter((part) => part.ok).length;
  const correct =
    frame.keywordMode === "ratio" ? hit / words.length >= frame.keywordRatio : hit === words.length;
  return { correct: Boolean(text) && correct, parts };
}

function gradeCustom(frame: ItemFrame, chosen: string[]): GradeReport {
  const got = tokenMap(chosen, "=");
  const key = tokenMap(frame.key, "=");
  const parts: GradePart[] = [];
  let correct = key.size > 0;
  for (const [id, expect] of key) {
    const field = frame.fields.find((item) => item.id === id);
    const value = got.get(id) ?? "";
    let ok = false;
    if (field?.kind === "multi") {
      const want = new Set(expect.split(/[+|]/).map((item) => item.trim()).filter(Boolean));
      const have = new Set(value.split(/[+|]/).map((item) => item.trim()).filter(Boolean));
      ok = want.size === have.size && [...want].every((item) => have.has(item));
    } else if (field?.kind === "number") {
      const a = Number(expect);
      const b = Number(value);
      ok = Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= frame.tolerance + 1e-9;
    } else ok = looseEq(expect, value);
    if (!ok) correct = false;
    parts.push({ target: id, ok, expect, got: value || "空" });
  }
  return { correct, parts };
}

export function gradeFrame(frame: ItemFrame, chosen: string[]): GradeReport {
  const clean = chosen.map((item) => item.trim()).filter(Boolean);
  if (frame.interaction === "material") {
    const parts: GradePart[] = [];
    let correct = frame.subs.length > 0;
    for (const sub of frame.subs) {
      const prefix = `${sub.id}@`;
      const inner = clean.filter((item) => item.startsWith(prefix)).map((item) => item.slice(prefix.length));
      const report = gradeFrame(sub, inner);
      if (!report.correct) correct = false;
      for (const part of report.parts) {
        parts.push({ ...part, target: part.target === "*" ? sub.id : `${sub.id}@${part.target}` });
      }
      if (!report.parts.length) {
        parts.push({ target: sub.id, ok: report.correct, expect: sub.key.join("、"), got: inner.join("、") || "空" });
      }
    }
    return { correct, parts };
  }
  if (frame.interaction === "order") {
    const correct = frame.key.length > 0 && frame.key.length === clean.length && frame.key.every((id, index) => clean[index] === id);
    const parts = frame.key.map((id, index) => ({
      target: id,
      ok: clean[index] === id,
      expect: `第 ${index + 1}`,
      got: clean.includes(id) ? `第 ${clean.indexOf(id) + 1}` : "没有",
    }));
    return { correct, parts };
  }
  if (frame.interaction === "pairs") return pairReport(frame, clean);
  if (frame.interaction === "hotspot") return gradeHotspot(frame, clean);
  if (frame.interaction === "numeric") {
    const expect = numericValue(frame.key[0]);
    const got = numericValue(clean[0]);
    const ok = Number.isFinite(expect) && Number.isFinite(got) && Math.abs(expect - got) <= frame.tolerance + 1e-9;
    return {
      correct: ok,
      parts: [{ target: "*", ok, expect: String(frame.key[0] ?? ""), got: clean[0] ?? "空" }],
    };
  }
  if (frame.interaction === "free") return gradeFree(frame, clean);
  if (frame.interaction === "custom") return gradeCustom(frame, clean);
  if (frame.interaction === "blanks" || frame.interaction === "slots" || frame.interaction === "bins" || frame.interaction === "matrix" || frame.interaction === "patch") {
    return assignReport(frame, clean);
  }
  return setReport(frame.key, clean, (id) => id);
}

export function answerText(frame: ItemFrame): string {
  if (frame.interaction === "material") {
    return frame.subs.map((sub) => `${sub.typeName || sub.id}：${answerText(sub)}`).join("；");
  }
  if (frame.interaction === "free") return frame.key[0] ?? frame.keywords.join("、");
  const named = (id: string, lists: FrameOpt[][]) => {
    for (const list of lists) {
      const found = list.find((item) => item.id === id);
      if (found) return found.text || id;
    }
    return id;
  };
  return canonicalChosen(frame)
    .map((token) => {
      if (token.includes(">")) {
        const [left, right] = token.split(">");
        return `${named(left ?? "", [frame.left, frame.options])} → ${named(right ?? "", [frame.right, frame.options])}`;
      }
      if (token.includes("=")) {
        const index = token.indexOf("=");
        return `${token.slice(0, index)} ${token.slice(index + 1)}`;
      }
      return named(token, [frame.options, frame.items, frame.regions.map((region) => ({ id: region.id, text: region.id }))]);
    })
    .join("、");
}

function pushOpt(lines: string[], prefix: string, opt: FrameOpt) {
  lines.push(`${prefix} ${opt.id}: ${opt.text}`);
  if (opt.image) lines.push(`${prefix} ${opt.id}.img: ${opt.image}`);
  if (opt.alt) lines.push(`${prefix} ${opt.id}.alt: ${opt.alt}`);
}

export function frameToText(frame: ItemFrame): string {
  const lines: string[] = ["@frame", `type: ${frame.typeName}`, `interaction: ${frame.interaction}`];
  if (frame.select === "many") lines.push("select: many");
  if (frame.unique) lines.push("unique: yes");
  if (frame.tolerance) lines.push(`tolerance: ${frame.tolerance}`);
  if (frame.keywordMode === "ratio") lines.push("keywordMode: ratio");
  if (frame.keywords.length) lines.push(`keywords: ${frame.keywords.join(" ; ")}`);
  if (frame.stem) {
    const [first, ...rest] = frame.stem.split("\n");
    lines.push(`stem: ${first ?? ""}`);
    for (const line of rest) lines.push(`stem+: ${line}`);
  }
  if (frame.stemCode) lines.push("stemCode: yes");
  if (frame.image) lines.push(`img: ${frame.image}`);
  if (frame.imageAlt) lines.push(`img.alt: ${frame.imageAlt}`);
  if (frame.imageCredit) lines.push(`img.credit: ${frame.imageCredit}`);
  if (frame.audio) lines.push(`audio: ${frame.audio}`);
  if (frame.audioTitle) lines.push(`audio.title: ${frame.audioTitle}`);
  if (frame.audioCredit) lines.push(`audio.credit: ${frame.audioCredit}`);
  for (const opt of frame.options) pushOpt(lines, "opt", opt);
  for (const opt of frame.left) pushOpt(lines, "left", opt);
  for (const opt of frame.right) pushOpt(lines, "right", opt);
  for (const opt of frame.rows) pushOpt(lines, "row", opt);
  for (const opt of frame.cols) pushOpt(lines, "col", opt);
  for (const opt of frame.items) pushOpt(lines, "item", opt);
  for (const opt of frame.bins) pushOpt(lines, "bin", opt);
  for (const region of frame.regions) lines.push(`region ${region.id}: ${region.x},${region.y},${region.r}`);
  for (const [id, options] of Object.entries(frame.blankOptions)) {
    for (const opt of options) lines.push(`blank ${id}.opt ${opt.id}: ${opt.text}`);
  }
  for (const field of frame.fields) {
    lines.push(`field ${field.id}.kind: ${field.kind}`);
    if (field.prompt) lines.push(`field ${field.id}.prompt: ${field.prompt}`);
    for (const opt of field.options) lines.push(`field ${field.id}.opt ${opt.id}: ${opt.text}`);
  }
  if (frame.key.length) lines.push(`key: ${frame.key.join(" ; ")}`);
  for (const bit of frame.explain) {
    lines.push(`explain ${bit.target}: ${bit.text.split("\n")[0] ?? ""}`);
    for (const extra of bit.text.split("\n").slice(1)) lines.push(`explain ${bit.target}+: ${extra}`);
    if (bit.image) lines.push(`explain ${bit.target}.img: ${bit.image}`);
    if (bit.alt) lines.push(`explain ${bit.target}.alt: ${bit.alt}`);
    if (bit.credit) lines.push(`explain ${bit.target}.credit: ${bit.credit}`);
  }
  for (const sub of frame.subs) {
    const block = frameToText(sub).replace(/^@frame\n/, "").replace(/\n@end$/, "");
    for (const line of block.split("\n")) {
      if (!line.trim()) continue;
      lines.push(`sub ${sub.id}.${line}`);
    }
  }
  lines.push("@end");
  return lines.join("\n");
}

export interface GalleryImage {
  src: string;
  alt: string;
  credit?: string;
}

export function collectImages(frame: ItemFrame | null | undefined, stem = "", explanation = ""): GalleryImage[] {
  const images: GalleryImage[] = [];
  const push = (src?: string, alt?: string, credit?: string) => {
    if (!src || images.some((item) => item.src === src)) return;
    images.push({ src, alt: alt || "题目图片", credit });
  };
  const fromText = (text: string) => {
    for (const piece of tokenizeRich(text)) {
      if (piece.k === "img") push(piece.src, piece.alt);
    }
  };
  fromText(stem);
  fromText(explanation);
  if (!frame) return images;
  push(frame.image, frame.imageAlt, frame.imageCredit);
  fromText(frame.stem);
  for (const list of [frame.options, frame.left, frame.right, frame.items, frame.bins, frame.rows]) {
    for (const opt of list) push(opt.image, opt.alt || opt.text);
  }
  for (const bit of frame.explain) push(bit.image, bit.alt, bit.credit);
  for (const sub of frame.subs) {
    for (const image of collectImages(sub, sub.stem, "")) push(image.src, image.alt, image.credit);
  }
  return images;
}

export type RichPiece =
  | { k: "text"; v: string }
  | { k: "img"; alt: string; src: string }
  | { k: "audio"; src: string; title: string }
  | { k: "blank"; id: string }
  | { k: "span"; id: string; v: string }
  | { k: "br" };

export function tokenizeRich(source: string): RichPiece[] {
  const pieces: RichPiece[] = [];
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[\[audio:([^|\]]+)\|([^\]]*)\]\]|\[\[([^|\]]+)\|([\s\S]*?)\]\]|\{\{([^}]+)\}\}|\n/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push({ k: "text", v: source.slice(cursor, index) });
    if (match[0] === "\n") pieces.push({ k: "br" });
    else if (match[1] !== undefined) pieces.push({ k: "img", alt: match[1], src: match[2] ?? "" });
    else if (match[3] !== undefined) pieces.push({ k: "audio", src: match[3], title: match[4] ?? "" });
    else if (match[5] !== undefined) pieces.push({ k: "span", id: match[5], v: match[6] ?? "" });
    else if (match[7] !== undefined) pieces.push({ k: "blank", id: match[7] });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) pieces.push({ k: "text", v: source.slice(cursor) });
  return pieces;
}

export function selectableOptionIds(frame: ItemFrame | null | undefined, legacyIds: string[], legacyType: string): string[] | null {
  if (!frame) {
    if (legacyType === "single" || legacyType === "multi" || legacyType === "judge") return legacyIds;
    return null;
  }
  if (frame.interaction === "choice" || frame.interaction === "judge") return frame.options.map((opt) => opt.id);
  return null;
}
