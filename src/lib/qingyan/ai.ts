import { createServerFn } from "@tanstack/react-start";
import { PROTOCOL } from "./protocol";

interface PlanInput {
  instruction: string;
  catalog: string;
}

interface ExplainInput {
  stem: string;
  chosen: string;
  answer: string;
  explanation: string;
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

async function grok(system: string, user: string, temperature: number) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false as const, error: "这台环境没有接上 AI，仍可以直接贴 JSON 操作。" };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature,
      max_tokens: 1800,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return { ok: false as const, error: `AI 暂时没有回应（${res.status}）` };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text) return { ok: false as const, error: "AI 返回是空的" };
  return { ok: true as const, text };
}

export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const arrayStart = raw.indexOf("[");
  const useArray = arrayStart >= 0 && (start < 0 || arrayStart < start);
  const from = useArray ? arrayStart : start;
  const end = useArray ? raw.lastIndexOf("]") : raw.lastIndexOf("}");
  if (from < 0 || end < from) throw new Error("没有找到 JSON");
  return JSON.parse(raw.slice(from, end + 1));
}

export const planEdits = createServerFn({ method: "POST" })
  .validator((input: PlanInput) => input)
  .handler(async ({ data }) => {
    const instruction = clip(data.instruction ?? "", 4000);
    const catalog = clip(data.catalog ?? "", 7000);
    if (instruction.length < 2) return { ok: false as const, error: "先写你想改什么" };
    const result = await grok(
      `你是青砚题库编辑。只输出 JSON：{"summary":"一句话","ops":[...]}。不要写markdown。ops 必须符合下面的协议，一次不超过 20 条。改已有题目时用 question.upsert，题干保持可识别。不要编造 progress.reset 或 bank.delete，除非用户明确要求删除。\n\n${PROTOCOL}`,
      `当前题库：\n${catalog}\n\n用户要求：\n${instruction}`,
      0.2,
    );
    if (!result.ok) return result;
    try {
      const parsed = extractJson(result.text);
      if (Array.isArray(parsed)) return { ok: true as const, summary: "已生成操作", ops: parsed };
      const record = parsed as { summary?: unknown; ops?: unknown };
      if (!Array.isArray(record.ops)) return { ok: false as const, error: "AI 没有给出 ops 数组" };
      return {
        ok: true as const,
        summary: typeof record.summary === "string" ? record.summary : "已生成操作",
        ops: record.ops,
      };
    } catch {
      return { ok: false as const, error: "AI 的结果不是合法 JSON，可以重试或改用手动操作" };
    }
  });

export const explainMiss = createServerFn({ method: "POST" })
  .validator((input: ExplainInput) => input)
  .handler(async ({ data }) => {
    const result = await grok(
      "你是一位耐心的中文老师。用不超过 140 字讲清这道题为什么这样答。不要称呼用户，不要列大纲，不要复读题干。",
      `题干：${clip(data.stem, 1500)}\n学生的作答：${clip(data.chosen, 500)}\n参考答案：${clip(data.answer, 500)}\n已有解析：${clip(data.explanation, 800)}`,
      0.4,
    );
    return result;
  });
