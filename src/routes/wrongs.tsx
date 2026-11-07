import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { answerLabel } from "@/lib/qingyan/grade";
import { useQingyan } from "@/lib/qingyan/store";
import { relTime } from "@/lib/qingyan/stats";
import type { Note, Question, WrongState } from "@/lib/qingyan/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wrongs")({ component: WrongsPage });

type Tab = "open" | "mastered" | "favorite" | "notes";

interface Row {
  question: Question;
  wrong?: WrongState;
  note?: Note;
}

function WrongsPage() {
  const lib = useQingyan((state) => state.lib);
  const setMastered = useQingyan((state) => state.setMastered);
  const toggleFavorite = useQingyan((state) => state.toggleFavorite);
  const [tab, setTab] = useState<Tab>("open");
  const [openId, setOpenId] = useState("");

  const rows: Row[] =
    tab === "favorite"
      ? lib.favorites.flatMap((id) => {
          const question = lib.questions.find((item) => item.id === id);
          return question ? [{ question }] : [];
        })
      : tab === "notes"
        ? lib.notes.flatMap((note) => {
            const question = lib.questions.find((item) => item.id === note.questionId);
            return question ? [{ question, note }] : [];
          })
        : lib.wrongs
            .filter((item) => (tab === "mastered" ? item.mastered : !item.mastered))
            .flatMap((wrong) => {
              const question = lib.questions.find((item) => item.id === wrong.questionId);
              return question ? [{ question, wrong }] : [];
            });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl">错题本</h1>
        <p className="mt-2 max-w-2xl text-muted">做错会进来。连续做对两次算掌握，还可以再翻出来。收藏和笔记不跟错题混在一起。</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["open", "未掌握"],
            ["mastered", "已掌握"],
            ["favorite", "收藏"],
            ["notes", "笔记"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn("min-h-11 rounded-md border px-3 text-sm", tab === id ? "border-primary bg-primary/15" : "border-line text-muted")}
          >
            {label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <p className="rounded-lg border border-line bg-surface p-6 text-muted">这里还是空的。</p> : null}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const note = row.note ?? lib.notes.find((item) => item.questionId === row.question.id);
          const bank = lib.banks.find((item) => item.id === row.question.bankId);
          const expanded = openId === row.question.id;
          return (
            <li key={row.question.id} className="rounded-lg border border-line bg-surface p-4">
              <button type="button" className="w-full text-left" onClick={() => setOpenId(expanded ? "" : row.question.id)}>
                <p className="text-xs text-muted">
                  {bank?.name}
                  {row.wrong ? ` · 错 ${row.wrong.wrongCount} 次 · ${relTime(row.wrong.lastAt)}` : ""}
                </p>
                <p className="mt-2 leading-6">{row.question.stem}</p>
              </button>
              {expanded ? (
                <div className="mt-3 border-t border-line pt-3 text-sm leading-6">
                  <p>
                    <span className="text-muted">答案 </span>
                    {answerLabel(row.question)}
                  </p>
                  {row.question.explanation ? <p className="mt-2">{row.question.explanation}</p> : null}
                  {note ? <p className="mt-2 text-muted">笔记：{note.text}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bank ? (
                      <Link
                        to="/practice/$bankId"
                        params={{ bankId: bank.id }}
                        search={{ mode: tab === "favorite" ? "favorite" : "wrong", chapter: "" }}
                        className={buttonVariants({ variant: "primary", size: "sm" })}
                      >
                        去重做
                      </Link>
                    ) : null}
                    {row.wrong ? (
                      <Button type="button" variant="surface" size="sm" onClick={() => setMastered(row.question.id, !row.wrong?.mastered)}>
                        {row.wrong.mastered ? "放回错题" : "标为掌握"}
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleFavorite(row.question.id)}>
                      {lib.favorites.includes(row.question.id) ? "取消收藏" : "收藏"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
