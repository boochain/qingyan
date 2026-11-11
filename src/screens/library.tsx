import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ImportActions } from "@/components/import-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import { bankAccuracy, unmasteredCount } from "@/lib/qingyan/stats";
import { Screen } from "@/screens/frame";

export function LibraryScreen() {
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  function createBank() {
    const results = apply([{ op: "bank.create", name, subject, description }]);
    const result = results[0];
    if (!result?.ok || !result.id) {
      toast.error(result?.message ?? "没建成");
      return;
    }
    toast.success("题库已建好");
    void navigate({ to: "/banks/$bankId/edit", params: { bankId: result.id }, search: { q: "" } });
  }

  return (
    <Screen
      title="题库"
      lede="目录。打开去练习，编辑去改题。导入按表里的题库名建库。"
      actions={
        <div className="flex flex-wrap gap-2">
          <ImportActions />
          <Button type="button" variant="ghost" onClick={() => setOpen((value) => !value)}>
            {open ? "收起" : "新建"}
          </Button>
        </div>
      }
    >
      {open ? (
        <form
          className="aero-float grid gap-3 p-4 pad:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            createBank();
          }}
        >
          <label className="flex flex-col gap-2 text-sm">
            名称
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 操作系统" />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            科目
            <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="计算机" />
          </label>
          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            说明
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div>
            <Button type="submit">建立并编辑</Button>
          </div>
        </form>
      ) : null}
      {lib.banks.length === 0 ? (
        <p className="text-sm text-muted">还没有题库。</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {lib.banks.map((bank) => {
            const count = lib.questions.filter((question) => question.bankId === bank.id).length;
            const rate = bankAccuracy(lib, bank.id);
            const wrongs = unmasteredCount(lib, bank.id);
            return (
              <li key={bank.id} className="flex flex-col gap-3 p-4 pad:flex-row pad:items-center pad:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{bank.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {bank.subject} · {count} 题
                    {rate !== null ? ` · ${rate}%` : ""}
                    {wrongs ? ` · 错 ${wrongs}` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pad:flex pad:shrink-0">
                  <Link to="/banks/$bankId" params={{ bankId: bank.id }} className={buttonVariants({ size: "sm" })}>
                    打开
                  </Link>
                  <Link
                    to="/banks/$bankId/edit"
                    params={{ bankId: bank.id }}
                    search={{ q: "" }}
                    className={buttonVariants({ variant: "surface", size: "sm" })}
                  >
                    编辑
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
