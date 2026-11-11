import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import type { PracticeMode } from "@/lib/qingyan/types";
import { cn } from "@/lib/utils";
import { useLibraryReady } from "@/screens/frame";

const MODES: { mode: PracticeMode; label: string }[] = [
  { mode: "order", label: "顺序" },
  { mode: "random", label: "随机" },
  { mode: "recite", label: "背题" },
  { mode: "wrong", label: "错题" },
];

export function BankScreen({ bankId }: { bankId: string }) {
  const navigate = useNavigate();
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const ready = useLibraryReady();
  const bank = lib.banks.find((item) => item.id === bankId);
  const [chapterId, setChapterId] = useState("");
  const chapters = lib.chapters.filter((chapter) => chapter.bankId === bankId).sort((a, b) => a.order - b.order);
  const total = lib.questions.filter((question) => question.bankId === bankId).length;
  const chapterName = chapters.find((chapter) => chapter.id === chapterId)?.name ?? "";
  const inChapter = chapterId ? lib.questions.filter((question) => question.chapterId === chapterId).length : total;

  if (!bank) {
    return (
      <div>
        <h1 className="text-lg font-semibold">{ready ? "这本题找不到了" : "正在打开这本题。"}</h1>
        {ready ? (
          <Link to="/banks" className={cn(buttonVariants({ variant: "surface" }), "mt-4")}>
            回题库
          </Link>
        ) : null}
      </div>
    );
  }

  function removeBank() {
    if (!confirm(`删除题库「${bank?.name}」以及里面的题目？`)) return;
    apply([{ op: "bank.delete", id: bankId }]);
    void navigate({ to: "/banks" });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="flex flex-col gap-3 pad:flex-row pad:items-end pad:justify-between">
        <div>
          <Link to="/banks" className="text-sm text-muted">
            题库
          </Link>
          <h1 className="mt-1 text-lg font-semibold">{bank.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {bank.subject}
            {bank.description ? ` · ${bank.description}` : ""}
          </p>
        </div>
        <Link to="/banks/$bankId/edit" params={{ bankId }} search={{ q: "" }} className={buttonVariants({ variant: "surface" })}>
          编辑
        </Link>
      </header>

      <div className="grid items-start gap-4 pad:grid-cols-2">
        <section className="aero-float p-4">
          <h2 className="text-sm font-semibold">练习</h2>
          <p className="mt-1 text-sm text-muted">
            {chapterName ? `顺序只走「${chapterName}」，${inChapter} 题。` : `整本 ${total} 题。`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 desk:flex desk:flex-wrap">
            {MODES.map((item) => (
              <Link
                key={item.mode}
                to="/practice/$bankId"
                params={{ bankId }}
                search={{ mode: item.mode, chapter: item.mode === "order" ? chapterId : "" }}
                className={buttonVariants({ variant: item.mode === "order" ? "primary" : "surface" })}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
        <section className="aero-float p-4">
          <h2 className="text-sm font-semibold">章节</h2>
          <p className="mt-1 text-sm text-muted">点一章再按顺序。改名和调顺序在编辑页。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pick on={chapterId === ""} label={`全部 ${total}`} pick={() => setChapterId("")} />
            {chapters.map((chapter) => {
              const count = lib.questions.filter((question) => question.chapterId === chapter.id).length;
              return (
                <Pick
                  key={chapter.id}
                  on={chapterId === chapter.id}
                  label={`${chapter.name} ${count}`}
                  pick={() => setChapterId(chapter.id)}
                />
              );
            })}
          </div>
        </section>
      </div>

      <div>
        <Button type="button" variant="danger" onClick={removeBank}>
          删除这本
        </Button>
      </div>
    </div>
  );
}

function Pick({ on, label, pick }: { on: boolean; label: string; pick: () => void }) {
  return (
    <button
      type="button"
      onClick={pick}
      className={cn("min-h-11 rounded-full border px-3 text-sm", on ? "gloss gloss-blue" : "border-transparent bg-white/45 text-muted")}
    >
      {label}
    </button>
  );
}
