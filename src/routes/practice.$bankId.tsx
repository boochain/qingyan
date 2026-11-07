import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QuestionView } from "@/components/question-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { explainMiss } from "@/lib/qingyan/ai";
import { answerLabel } from "@/lib/qingyan/grade";
import { buildQueue, resumeKey } from "@/lib/qingyan/queue";
import { useQingyan } from "@/lib/qingyan/store";
import type { PracticeMode } from "@/lib/qingyan/types";
import { MODE_LABEL } from "@/lib/qingyan/types";
import { cn } from "@/lib/utils";

const MODES = ["order", "random", "chapter", "wrong", "recite", "favorite"] as const;

export const Route = createFileRoute("/practice/$bankId")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (MODES.includes(search.mode as (typeof MODES)[number]) ? search.mode : "order") as PracticeMode,
    chapter: typeof search.chapter === "string" ? search.chapter : "",
  }),
  component: PracticePage,
});

function PracticePage() {
  const { bankId } = Route.useParams();
  const { mode, chapter } = Route.useSearch();
  const lib = useQingyan((state) => state.lib);
  const bank = lib.banks.find((item) => item.id === bankId);
  if (!bank) {
    return <h1 className="font-display text-3xl">题库不在了</h1>;
  }
  return <Session key={`${bankId}:${mode}:${chapter}`} bankId={bankId} bankName={bank.name} mode={mode} chapter={chapter} />;
}

function Session({
  bankId,
  bankName,
  mode,
  chapter,
}: {
  bankId: string;
  bankName: string;
  mode: PracticeMode;
  chapter: string;
}) {
  const lib = useQingyan((state) => state.lib);
  const recordAnswer = useQingyan((state) => state.recordAnswer);
  const toggleFavorite = useQingyan((state) => state.toggleFavorite);
  const setNote = useQingyan((state) => state.setNote);
  const setResume = useQingyan((state) => state.setResume);
  const key = resumeKey(bankId, mode, chapter);
  const [session, setSession] = useState(() => {
    const saved = useQingyan.getState().lib.resume[key];
    if (saved?.ids.length) return saved;
    return { ids: buildQueue(useQingyan.getState().lib, bankId, mode, chapter), index: 0 };
  });
  const [chosen, setChosen] = useState<string[]>([]);
  const [phase, setPhase] = useState<"answer" | "reveal">("answer");
  const [log, setLog] = useState<{ id: string; correct: boolean }[]>([]);
  const [note, setNoteText] = useState("");
  const [ai, setAi] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const ids = session.ids.filter((id) => lib.questions.some((question) => question.id === id));
  const finished = session.index >= ids.length;
  const question = ids[session.index] ? lib.questions.find((item) => item.id === ids[session.index]) : undefined;

  useEffect(() => {
    setResume(key, { ids: session.ids, index: session.index });
  }, [key, session.ids, session.index, setResume]);

  useEffect(() => {
    const saved = useQingyan.getState().lib.notes.find((item) => item.questionId === question?.id);
    setNoteText(saved?.text ?? "");
    setAi("");
    setChosen([]);
    setPhase(mode === "recite" ? "reveal" : "answer");
  }, [question?.id, mode]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!question || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (mode === "recite") return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < question.choices.length && phase === "answer") {
        const id = question.choices[index]!.id;
        if (question.type === "multi") {
          setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
        } else if (question.type === "single" || question.type === "judge") setChosen([id]);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (phase === "answer") {
          if (chosen.join("").trim()) grade();
        } else go(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function grade(override?: string[]) {
    if (!question) return;
    const answer = override ?? chosen;
    const correct = recordAnswer(question.id, answer, mode);
    setLog((current) => [...current, { id: question.id, correct }]);
    setPhase("reveal");
  }

  function go(step: number) {
    setSession((current) => ({
      ...current,
      index: Math.min(ids.length, Math.max(0, current.index + step)),
    }));
  }

  function restart() {
    const next = { ids: buildQueue(useQingyan.getState().lib, bankId, mode, chapter), index: 0 };
    setSession(next);
    setLog([]);
    setResume(key, next);
  }

  async function ask() {
    if (!question) return;
    setAiBusy(true);
    try {
      const result = await explainMiss({
        data: {
          stem: question.stem,
          chosen: chosen.join("、") || "（空）",
          answer: answerLabel(question),
          explanation: question.explanation,
        },
      });
      setAi(result.ok ? result.text : result.error);
    } catch {
      setAi("讲解没能发出去");
    } finally {
      setAiBusy(false);
    }
  }

  if (!ids.length || (finished && !question)) {
    const correct = log.filter((item) => item.correct).length;
    return (
      <div className="max-w-xl">
        <p className="text-sm text-muted">{bankName} · {MODE_LABEL[mode]}</p>
        <h1 className="mt-2 font-display text-4xl">{ids.length === 0 ? "这一轮没有题目" : "这一轮结束了"}</h1>
        {log.length ? (
          <p className="mt-3 text-muted tabular-nums">
            做对 {correct} / {log.length}
          </p>
        ) : (
          <p className="mt-3 text-muted">错题、收藏或章节是空的时候会出现这里。换一种练法，或先去做题。</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={restart}>
            再来一轮
          </Button>
          <Link to="/banks/$bankId" params={{ bankId }} className={buttonVariants({ variant: "surface" })}>
            回题库
          </Link>
          <Link to="/wrongs" className={buttonVariants({ variant: "ghost" })}>
            错题本
          </Link>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{bankName} · {MODE_LABEL[mode]}</p>
          <p className="mt-1 tabular-nums text-sm text-muted">
            {Math.min(session.index + 1, ids.length)} / {ids.length}
          </p>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, (session.index / ids.length) * 100)}%` }}
          />
        </div>
      </div>
      <QuestionView
        question={question}
        chosen={mode === "recite" ? question.answer : chosen}
        onChange={setChosen}
        revealed={phase === "reveal" || mode === "recite"}
        favorite={lib.favorites.includes(question.id)}
        onFavorite={() => toggleFavorite(question.id)}
      />
      {phase === "reveal" || mode === "recite" ? (
        <div className="rounded-lg border border-line bg-surface p-4">
          <label className="flex flex-col gap-2 text-sm">
            笔记，只给自己看
            <textarea value={note} onChange={(event) => setNoteText(event.target.value)} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="surface" onClick={() => setNote(question.id, note)}>
              保存笔记
            </Button>
            <Button type="button" variant="ghost" onClick={() => void ask()} disabled={aiBusy}>
              {aiBusy ? "正在讲" : "让 AI 讲这道"}
            </Button>
          </div>
          {ai ? <p className="mt-3 text-sm leading-6">{ai}</p> : null}
        </div>
      ) : null}
      <div className="sticky bottom-16 z-10 flex flex-wrap gap-2 rounded-lg border border-line bg-bg/95 p-3 md:bottom-0">
        <Button type="button" variant="ghost" onClick={() => go(-1)} disabled={session.index === 0}>
          上一题
        </Button>
        {mode === "recite" ? (
          <>
            <Button type="button" variant="moss" onClick={() => { grade(question.answer); go(1); }}>
              记得
            </Button>
            <Button type="button" variant="danger" onClick={() => { grade([]); go(1); }}>
              模糊
            </Button>
          </>
        ) : phase === "answer" ? (
          <Button type="button" onClick={() => grade()} disabled={chosen.join("").trim().length === 0}>
            提交
          </Button>
        ) : (
          <Button type="button" onClick={() => (session.index + 1 >= ids.length ? setSession((s) => ({ ...s, index: ids.length })) : go(1))}>
            下一题
          </Button>
        )}
        {mode === "recite" ? (
          <Button type="button" variant="ghost" onClick={() => go(1)}>
            跳过
          </Button>
        ) : null}
        <button type="button" className="ml-auto text-sm text-muted" onClick={restart}>
          重开
        </button>
      </div>
      <p className="hidden text-xs text-muted md:block">数字键选选项，回车提交或下一题。</p>
      <Link to="/banks/$bankId" params={{ bankId }} className={cn("text-sm text-muted")}>
        先离开
      </Link>
    </div>
  );
}
