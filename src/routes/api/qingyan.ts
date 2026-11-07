import { createFileRoute } from "@tanstack/react-router";
import { applyOps } from "@/lib/qingyan/ops";
import { parseImport } from "@/lib/qingyan/io";
import { OP_EXAMPLE, PROTOCOL } from "@/lib/qingyan/protocol";
import { emptyLibrary, type Library } from "@/lib/qingyan/types";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

function isLibrary(value: unknown): value is Library {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Library>;
  return record.version === 1 && Array.isArray(record.banks) && Array.isArray(record.questions);
}

export const Route = createFileRoute("/api/qingyan")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers }),
      GET: async () =>
        Response.json(
          {
            name: "青砚",
            protocol: PROTOCOL,
            example: JSON.parse(OP_EXAMPLE) as unknown,
            note: "本接口不保存题库。把 library 和 ops 一起提交，取回新的 library。",
          },
          { headers },
        ),
      POST: async ({ request }) => {
        const length = Number(request.headers.get("content-length") ?? 0);
        if (length > 1_500_000) {
          return Response.json({ ok: false, error: "文档太大" }, { status: 413, headers });
        }
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "需要 JSON" }, { status: 400, headers });
        }
        const library = isLibrary(body.library) ? body.library : emptyLibrary();
        try {
          if (body.action === "import") {
            const text = typeof body.text === "string" ? body.text : "";
            const plan = parseImport(text, typeof body.bank === "string" ? body.bank : "导入的题库");
            if (plan.kind === "replace") {
              return Response.json({ ok: true, library: plan.library, results: [] }, { headers });
            }
            const out = applyOps(library, plan.ops);
            return Response.json({ ok: out.results.every((item) => item.ok), library: out.library, results: out.results }, { headers });
          }
          const ops = Array.isArray(body.ops) ? body.ops : [];
          const out = applyOps(library, ops);
          return Response.json(
            { ok: out.results.every((item) => item.ok), library: out.library, results: out.results },
            { headers },
          );
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "失败" },
            { status: 400, headers },
          );
        }
      },
    },
  },
});
