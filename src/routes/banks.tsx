import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import { bankAccuracy, unmasteredCount } from "@/lib/qingyan/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/banks")({ component: BanksPage });

function BanksPage() {
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  function createBank() {
    const results = apply([{ op: "bank.create", name, subject, description }]);
    if (!results[0]?.ok) {
      toast.error(results[0]?.message ?? "没建成");
      return;
    }
    toast.success("题库已建好");
    setName("");
    setSubject("");
    setDescription("");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">题库</h1>
          <p className="mt-2 text-muted">一个科目一本。章节在进去之后再分。</p>
        </div>
        <Button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? "收起" : "新题库"}
        </Button>
      </header>
      {open ? (
        <form
          className="grid gap-3 rounded-lg border border-line bg-surface p-5 md:grid-cols-2"
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
            一句话说明
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div>
            <Button type="submit">建立</Button>
          </div>
        </form>
      ) : null}
      <div className="grid gap-3">
        {lib.banks.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface p-6 text-muted">一本都没有。建一本，或到 Agent 页导入。</p>
        ) : null}
        {lib.banks.map((bank) => {
          const count = lib.questions.filter((question) => question.bankId === bank.id).length;
          const rate = bankAccuracy(lib, bank.id);
          const wrongs = unmasteredCount(lib, bank.id);
          return (
            <article key={bank.id} className="rounded-lg border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">{bank.subject}</p>
                  <h2 className="mt-1 font-display text-2xl">{bank.name}</h2>
                  <p className="mt-2 max-w-xl text-sm text-muted">{bank.description || "还没有说明"}</p>
                </div>
                <p className="text-sm tabular-nums text-muted">
                  {count} 题
                  {rate !== null ? ` · ${rate}%` : ""}
                  {wrongs ? ` · 错 ${wrongs}` : ""}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/banks/$bankId" params={{ bankId: bank.id }} className={buttonVariants({ variant: "surface" })}>
                  管理
                </Link>
                <Link
                  to="/practice/$bankId"
                  params={{ bankId: bank.id }}
                  search={{ mode: "order", chapter: "" }}
                  className={cn(buttonVariants())}
                >
                  顺序练习
                </Link>
                <Link
                  to="/practice/$bankId"
                  params={{ bankId: bank.id }}
                  search={{ mode: "random", chapter: "" }}
                  className={buttonVariants({ variant: "ghost" })}
                >
                  随机
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
