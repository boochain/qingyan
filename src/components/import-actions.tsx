import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mergeLibrary, type ImportPlan } from "@/lib/qingyan/io";
import { describeImport, runOps } from "@/lib/qingyan/run-ops";
import { useQingyan } from "@/lib/qingyan/store";
import { downloadDocxTemplate, downloadXlsxTemplate, readImportFile } from "@/lib/qingyan/import-file";

export function ImportActions({
  fallbackBank,
  importLabel = "导入题库",
  prominent = true,
}: {
  fallbackBank?: string;
  importLabel?: string;
  prominent?: boolean;
}) {
  const apply = useQingyan((state) => state.apply);
  const replace = useQingyan((state) => state.replace);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const plan = await readImportFile(file, fallbackBank || "导入的题库");
      commit(plan);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function commit(plan: ImportPlan) {
    if (plan.kind === "replace") {
      const current = useQingyan.getState().lib;
      replace(mergeLibrary(current, plan.library));
      const count = plan.library.questions.length;
      toast.success(count ? `已并入 ${count} 道题` : "已并入这份题库");
      return;
    }
    const summary = describeImport(runOps(apply, plan.ops));
    if (!summary.written && !summary.failed) {
      toast.error("没有题目");
      return;
    }
    if (!summary.written && summary.failed) {
      toast.error(summary.firstError ?? "没有写入");
      return;
    }
    if (summary.failed) {
      toast.error(`写入 ${summary.written} 道题，${summary.failed} 道没写上：${summary.firstError ?? ""}`);
      return;
    }
    toast.success(`已写入 ${summary.written} 道题`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant={prominent ? "primary" : "surface"} disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "正在导入" : importLabel}
      </Button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".xlsx,.xls,.csv,.docx,.txt,.md,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label={importLabel}
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <Button type="button" variant="surface" onClick={() => void downloadXlsxTemplate().catch(() => toast.error("模板没能生成"))}>
        Excel 模板
      </Button>
      <Button type="button" variant="surface" onClick={() => void downloadDocxTemplate().catch(() => toast.error("模板没能生成"))}>
        Word 模板
      </Button>
    </div>
  );
}
