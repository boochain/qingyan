import { rowsToOps, TABLE_COLUMNS, TABLE_NOTES, TABLE_SAMPLE } from "./rows";

function toArrayBuffer(out: unknown): ArrayBuffer {
  if (out instanceof ArrayBuffer) return out;
  const bytes = Uint8Array.from(out as ArrayLike<number>);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function xlsxToOps(data: ArrayBuffer, fallbackBank: string): Promise<unknown[]> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(data, { type: "array" });
  const names = book.SheetNames.map((item) => item.trim());
  const picked =
    book.SheetNames.find((item) => item.trim() === "题目") ??
    book.SheetNames.find((item) => item.trim() !== "说明") ??
    book.SheetNames[0];
  if (!picked || names.length === 0) throw new Error("Excel 里没有工作表");
  const sheet = book.Sheets[picked];
  if (!sheet) throw new Error("Excel 里没有工作表");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rowsToOps(rows, { bank: fallbackBank, source: "excel" });
}

export async function xlsxTemplateBuffer(): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const header = [...TABLE_COLUMNS];
  const body = TABLE_SAMPLE.map((row) => header.map((key) => row[key] ?? ""));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet["!cols"] = header.map((key) => ({ wch: key === "题干" || key === "框架" || key === "解析" ? 36 : 14 }));
  const notes = XLSX.utils.aoa_to_sheet(TABLE_NOTES.map((line) => [line]));
  notes["!cols"] = [{ wch: 88 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "题目");
  XLSX.utils.book_append_sheet(book, notes, "说明");
  return toArrayBuffer(XLSX.write(book, { bookType: "xlsx", type: "array" }));
}
