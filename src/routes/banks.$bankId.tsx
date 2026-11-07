import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { QuestionEditor } from "@/components/question-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import type { PracticeMode, QType, Question } from "@/lib/qingyan/types";
import { TYPE_LABEL } from "@/lib/qingyan/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/banks/$bankId")({ component: BankPage });

const MODES: { mode: PracticeMode; label: string }[] = [
  { mode: "order", label: "顺序" },
  { mode: "random", label: "随机" },
  { mode: "recite", label: "背题" },
  { mode: "wrong", label: "错题" },
];

function BankPage() {
  const { bankId } = Route.useParams();
  const navigate = useNavigate();
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const bank = lib.banks.find((item) => item.id === bankId);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<QType | "all">("all");
  const [chapterId, setChapterId] = useState("");
  const [shown, setShown] = useState(40);
  const [editor, setEditor] = useState<Question | null | "new">(null);

  const chapters = lib.chapters.filter((chapter) => chapter.bankId === bankId).sort((a, b) => a.order - b.order);
  const questions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return lib.questions.filter((question) => {
      if (question.bankId !== bankId) return false;
      if (chapterId && question.chapterId !== chapterId) return false;
      if (type !== "all" && question.type !== type) return false;
      if (!needle) return true;
      return (
        question.stem.toLowerCase().includes(needle) ||
        question.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [lib.questions, bankId, chapterId, type, query]);

  if (!bank) {
    return (
      <div>
        <h1 className="font-display text-3xl">这本题找不到了</h1>
        <Link to="/banks" className={cn(buttonVariants({ variant: "surface" }), "mt-4")}>
          回题库
        </Link>
      </div>
    );
  }

  function remove(question: Question) {
    if (!confirm("删除这道题？做题记录会留下，题目本身不再出现。")) return;
    const results = apply([{ op: "question.delete", id: question.id }]);
    if (results[0]?.ok) toast.success("已删除");
    else toast.error(results[0]?.message ?? "没删掉");
  }

  function removeBank() {
    if (!confirm(`删除题库「${bank?.name}」以及里面的题目？`)) return;
    apply([{ op: "bank.delete", id: bankId }]);
    void navigate({ to: "/banks" });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs text-muted">{bank.subject}</p>
        <h1 className="mt-1 font-display text-4xl">{bank.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">{bank.description || "给这本题写一句说明，方便以后辨认。"}</p>
      </header>
      <div className="flex flex-wrap gap-2">
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
        <Button type="button" variant="ghost" onClick={() => setEditor("new")}>
          加一道题
        </Button>
        <Link to="/agent" className={buttonVariants({ variant: "ghost" })}>
          导入 / Agent
        </Link>
        <Button type="button" variant="danger" onClick={removeBank}>
          删除题库
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜题干或标签" />
        <div className="flex flex-wrap gap-2">
          <Filter on={chapterId === ""} label="全部章节" pick={() => setChapterId("")} />
          {chapters.map((chapter) => (
            <Filter key={chapter.id} on={chapterId === chapter.id} label={chapter.name} pick={() => setChapterId(chapter.id)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Filter on={type === "all"} label="全部题型" pick={() => setType("all")} />
          {(Object.keys(TYPE_LABEL) as QType[]).map((item) => (
            <Filter key={item} on={type === item} label={TYPE_LABEL[item]} pick={() => setType(item)} />
          ))}
        </div>
      </div>
      <p className="text-sm tabular-nums text-muted">{questions.length} 题</p>
      <ul className="flex flex-col gap-2">
        {questions.slice(0, shown).map((question) => {
          const chapter = chapters.find((item) => item.id === question.chapterId);
          return (
            <li key={question.id} className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{TYPE_LABEL[question.type]}</span>
                <span>{chapter?.name}</span>
                <span>{question.difficulty === 1 ? "易" : question.difficulty === 3 ? "难" : "中"}</span>
              </div>
              <p className="mt-2 leading-6">{question.stem}</p>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="surface" size="sm" onClick={() => setEditor(question)}>
                  编辑
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(question)}>
                  删除
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {shown < questions.length ? (
        <Button type="button" variant="surface" onClick={() => setShown((value) => value + 40)}>
          再看 40 题
        </Button>
      ) : null}
      <QuestionEditor
        bankId={bankId}
        bankName={bank.name}
        question={editor === "new" ? null : editor}
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      />
    </div>
  );
}

function Filter({ on, label, pick }: { on: boolean; label: string; pick: () => void }) {
  return (
    <button
      type="button"
      onClick={pick}
      className={cn(
        "min-h-11 rounded-md border px-3 text-sm",
        on ? "border-primary bg-primary/15 text-fg" : "border-line text-muted",
      )}
    >
      {label}
    </button>
  );
}
