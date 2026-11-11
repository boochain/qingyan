import { parseImport } from "./io";
import type { Library } from "./types";
import { docxToPlain, wordTemplateBuffer } from "./docx";
import { xlsxTemplateBuffer, xlsxToOps } from "./xlsx";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function downloadBuffer(filename: string, data: ArrayBuffer, mime: string) {
  const blob = new Blob([new Uint8Array(data)], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadXlsxTemplate() {
  downloadBuffer("青砚题库模板.xlsx", await xlsxTemplateBuffer(), XLSX_MIME);
}

export async function downloadDocxTemplate() {
  downloadBuffer("青砚题库模板.docx", await wordTemplateBuffer(), DOCX_MIME);
}

export async function readImportFile(
  file: File,
  fallbackBank: string,
): Promise<{ kind: "ops"; ops: unknown[] } | { kind: "replace"; library: Library }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc") && !name.endsWith(".docx")) throw new Error("旧版 .doc 请在 Word 里另存为 .docx");
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return { kind: "ops", ops: await xlsxToOps(await file.arrayBuffer(), fallbackBank) };
  }
  if (name.endsWith(".docx")) return parseImport(await docxToPlain(await file.arrayBuffer()), fallbackBank);
  return parseImport(await file.text(), fallbackBank);
}
