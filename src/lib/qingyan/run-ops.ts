import type { OpResult } from "./ops";

export const OP_CHUNK = 180;

export function runOps(apply: (ops: unknown[]) => OpResult[], ops: unknown[]): OpResult[] {
  const all: OpResult[] = [];
  const size = OP_CHUNK;
  for (let offset = 0; offset < ops.length; offset += size) {
    const results = apply(ops.slice(offset, offset + size));
    for (const result of results) all.push({ ...result, index: result.index + offset });
  }
  return all;
}

export function describeImport(results: OpResult[]) {
  let written = 0;
  for (const result of results) {
    if (!result.ok) continue;
    if (result.op === "question.upsert") written += 1;
    else if (result.op === "question.bulk") {
      const matched = /写入 (\d+) 题/.exec(result.message);
      written += matched ? Number(matched[1]) : 0;
    }
  }
  const failed = results.filter((item) => !item.ok);
  return { written, failed: failed.length, firstError: failed[0]?.message };
}
