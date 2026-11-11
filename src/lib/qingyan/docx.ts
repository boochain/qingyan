import JSZip from "jszip";
import { WORD_TEMPLATE } from "./rows";

function decodeXml(value: string): string {
  return value
    .replace(/\u0026lt;/g, "<")
    .replace(/\u0026gt;/g, ">")
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026apos;/g, "'")
    .replace(/\u0026amp;/g, "&");
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;");
}

interface NumLevel {
  start: number;
  fmt: string;
  lvlText: string;
}

function parseNumbering(xml: string): Map<string, Map<string, NumLevel>> {
  const abstracts = new Map<string, Map<string, NumLevel>>();
  for (const block of xml.split(/<w:abstractNum[\s>]/).slice(1)) {
    const id = /w:abstractNumId="(\d+)"/.exec(block)?.[1];
    if (!id) continue;
    const levels = new Map<string, NumLevel>();
    for (const lvl of block.split(/<w:lvl[\s>]/).slice(1)) {
      const ilvl = /w:ilvl="(\d+)"/.exec(lvl)?.[1] ?? "0";
      const start = Number(/<w:start\b[^>]*w:val="(\d+)"/.exec(lvl)?.[1] ?? "1");
      const fmt = /<w:numFmt\b[^>]*w:val="([^"]+)"/.exec(lvl)?.[1] ?? "decimal";
      const lvlText = decodeXml(/<w:lvlText\b[^>]*w:val="([^"]*)"/.exec(lvl)?.[1] ?? "%1.");
      levels.set(ilvl, { start, fmt, lvlText });
    }
    abstracts.set(id, levels);
  }
  const nums = new Map<string, Map<string, NumLevel>>();
  for (const block of xml.split(/<w:num[\s>]/).slice(1)) {
    const numId = /w:numId="(\d+)"/.exec(block)?.[1];
    const abstractId = /<w:abstractNumId\b[^>]*w:val="(\d+)"/.exec(block)?.[1];
    if (!numId || !abstractId) continue;
    const levels = abstracts.get(abstractId);
    if (levels) nums.set(numId, levels);
  }
  return nums;
}

function formatNum(fmt: string, n: number): string {
  if (fmt === "upperLetter" || fmt === "lowerLetter") {
    const base = fmt === "upperLetter" ? 65 : 97;
    let value = n;
    let out = "";
    while (value > 0) {
      value -= 1;
      out = String.fromCharCode(base + (value % 26)) + out;
      value = Math.floor(value / 26);
    }
    return out || String.fromCharCode(base);
  }
  if (fmt === "decimal" || fmt === "decimalZero") return String(n);
  return "";
}

function paragraphText(part: string): string {
  const pieces: string[] = [];
  const pattern = /<w:t\b[^>]*>([^<]*)<\/w:t>|<w:br\b[^>]*\/>|<w:cr\b[^>]*\/>|<w:tab\b[^>]*\/>/g;
  for (const match of part.matchAll(pattern)) {
    if (match[1] != null) pieces.push(decodeXml(match[1]));
    else if (match[0].includes(":tab")) pieces.push("\t");
    else pieces.push("\n");
  }
  return pieces.join("");
}

function numberedPrefix(
  part: string,
  numbering: Map<string, Map<string, NumLevel>>,
  counters: Map<string, number[]>,
): string {
  const numId = /<w:numId\b[^>]*w:val="(\d+)"/.exec(part)?.[1];
  if (!numId || numId === "0") return "";
  const levels = numbering.get(numId);
  if (!levels) return "";
  const ilvl = /<w:ilvl\b[^>]*w:val="(\d+)"/.exec(part)?.[1] ?? "0";
  const spec = levels.get(ilvl) ?? levels.get("0");
  if (!spec || spec.fmt === "bullet" || spec.fmt === "none") return "";
  const depth = Number(ilvl);
  const current = counters.get(numId) ?? [];
  current[depth] = (current[depth] ?? spec.start - 1) + 1;
  for (let index = depth + 1; index < current.length; index += 1) current[index] = 0;
  counters.set(numId, current);
  const token = formatNum(spec.fmt, current[depth] ?? spec.start);
  if (!token) return "";
  return spec.lvlText.replace(/%\d/g, token);
}

export async function docxToPlain(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("这份 Word 读不了。请另存为 .docx。");
  const numberingXml = await zip.file("word/numbering.xml")?.async("string");
  const numbering = numberingXml ? parseNumbering(numberingXml) : new Map<string, Map<string, NumLevel>>();
  const counters = new Map<string, number[]>();
  const lines: string[] = [];
  for (const part of xml.split(/<w:p[\s>]/).slice(1)) {
    let text = paragraphText(part);
    const prefix = numberedPrefix(part, numbering, counters);
    if (prefix && !/^\s*(?:\d+|[A-Ha-h])[.、．)]/.test(text)) text = `${prefix} ${text}`.trim();
    lines.push(text);
  }
  const text = lines.join("\n").trim();
  if (!text) throw new Error("Word 里没有文字");
  return text;
}

function documentXml(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n").map((line) => {
    return `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>
  </w:body>
</w:document>`;
}

export async function wordTemplateBuffer(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder("word")?.file("document.xml", documentXml(WORD_TEMPLATE));
  return zip.generateAsync({ type: "arraybuffer" });
}
