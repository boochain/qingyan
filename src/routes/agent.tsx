import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { planEdits } from "@/lib/qingyan/ai";
import { applyImport, downloadText, libraryToCsv, libraryToMarkdown, parseImport, sampleCsv } from "@/lib/qingyan/io";
import { catalogForAgent, OP_EXAMPLE, PROTOCOL } from "@/lib/qingyan/protocol";
import { useQingyan } from "@/lib/qingyan/store";
import type { OpResult } from "@/lib/qingyan/ops";

export const Route = createFileRoute("/agent")({ component: AgentPage });

function AgentPage() {
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const replace = useQingyan((state) => state.replace);
  const [instruction, setInstruction] = useState("给「计算机网络」增加一道关于 TCP 拥塞控制的单选题，放进传输层。");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [draft, setDraft] = useState("");
  const [manual, setManual] = useState(OP_EXAMPLE);
  const [incoming, setIncoming] = useState("");
  const [bankName, setBankName] = useState(lib.banks[0]?.name ?? "导入的题库");
  const [log, setLog] = useState<OpResult[]>([]);

  function report(results: OpResult[]) {
    setLog(results);
    const failed = results.filter((item) => !item.ok).length;
    if (!results.length) toast.error("没有操作");
    else if (failed) toast.error(`完成 ${results.length - failed}，失败 ${failed}`);
    else toast.success(`已执行 ${results.length} 条`);
  }

  async function plan() {
    setBusy(true);
    setSummary("");
    try {
      const result = await planEdits({ data: { instruction, catalog: catalogForAgent(lib) } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.summary);
      setDraft(JSON.stringify(result.ops, null, 2));
    } catch {
      toast.error("没能请到 AI");
    } finally {
      setBusy(false);
    }
  }

  function runJson(raw: string) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const ops = Array.isArray(parsed) ? parsed : [parsed];
      report(apply(ops));
    } catch {
      toast.error("这不是合法 JSON");
    }
  }

  function runImport(how: "merge" | "replace") {
    try {
      const planResult = parseImport(incoming, bankName);
      if (planResult.kind === "ops") {
        report(apply(planResult.ops));
        return;
      }
      if (how === "replace" && !confirm("用这份文件替换当前全部题库？做题记录也会换成文件里的。")) return;
      replace(applyImport(lib, planResult, how));
      toast.success(how === "replace" ? "已替换整库" : "已合并题目");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setIncoming(await file.text());
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <header>
          <h1 className="font-display text-4xl">Agent 工作台</h1>
          <p className="mt-2 max-w-2xl text-muted">
            人和外部 Agent 用同一份操作协议。这里改的是这台浏览器里的题库。服务器接口只变换你提交的文档，不替你保存。
          </p>
        </header>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">用一句话改题</h2>
          <textarea className="mt-3" value={instruction} onChange={(event) => setInstruction(event.target.value)} />
          <Button type="button" className="mt-3" onClick={() => void plan()} disabled={busy}>
            {busy ? "正在起草" : "让 AI 起草操作"}
          </Button>
          {summary ? <p className="mt-3 text-sm">{summary}</p> : null}
          {draft ? (
            <>
              <textarea className="mt-3 font-mono text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} />
              <Button type="button" className="mt-3" variant="moss" onClick={() => runJson(draft)}>
                确认写入
              </Button>
            </>
          ) : null}
        </section>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">直接执行 JSON</h2>
          <p className="mt-2 text-sm text-muted">一条操作，或一个数组。外部 Agent 也可以原样 POST 到 /api/qingyan。</p>
          <textarea className="mt-3 font-mono text-sm" value={manual} onChange={(event) => setManual(event.target.value)} />
          <Button type="button" className="mt-3" onClick={() => runJson(manual)}>
            执行
          </Button>
        </section>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">导入与导出</h2>
          <label className="mt-3 flex flex-col gap-2 text-sm">
            新题默认放进
            <input value={bankName} onChange={(event) => setBankName(event.target.value)} />
          </label>
          <textarea
            className="mt-3"
            placeholder={"支持整库 JSON、ops、CSV，或这样的文本：\n# 计算机网络\n## 传输层\n1. 题干\nA. …\nB. …\n答案：B\n解析：…"}
            value={incoming}
            onChange={(event) => setIncoming(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={fileButton}>
              选择文件
              <input
                className="sr-only"
                type="file"
                accept=".json,.csv,.txt,.md,text/plain"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
            </label>
            <Button type="button" variant="moss" onClick={() => runImport("merge")}>
              合并进去
            </Button>
            <Button type="button" variant="danger" onClick={() => runImport("replace")}>
              整库替换
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="surface" onClick={() => downloadText("qingyan.json", JSON.stringify(lib, null, 2), "application/json")}>
              导出 JSON
            </Button>
            <Button type="button" variant="surface" onClick={() => downloadText("qingyan.csv", libraryToCsv(lib), "text/csv")}>
              导出 CSV
            </Button>
            <Button type="button" variant="surface" onClick={() => downloadText("qingyan.md", libraryToMarkdown(lib), "text/markdown")}>
              导出 Markdown
            </Button>
            <Button type="button" variant="ghost" onClick={() => downloadText("qingyan-sample.csv", sampleCsv(), "text/csv")}>
              下载示例 CSV
            </Button>
          </div>
        </section>
        {log.length ? (
          <ul className="flex flex-col gap-2">
            {log.map((item) => (
              <li key={`${item.index}-${item.message}`} className={`rounded-md border px-3 py-2 text-sm ${item.ok ? "border-line" : "border-primary text-primary"}`}>
                {item.op} · {item.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <aside className="rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-display text-xl">协议</h2>
        <p className="mt-2 text-sm text-muted">复制给任何 Agent 当系统说明。</p>
        <Button
          type="button"
          variant="surface"
          className="mt-3"
          onClick={() => {
            void navigator.clipboard.writeText(PROTOCOL).then(
              () => toast.success("协议已复制"),
              () => toast.error("复制失败"),
            );
          }}
        >
          复制协议
        </Button>
        <pre className="mt-4 max-h-[70vh] overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted">{PROTOCOL}</pre>
      </aside>
    </div>
  );
}

const fileButton =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-line bg-surface-2 px-4 text-sm";
