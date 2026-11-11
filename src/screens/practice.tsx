import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QuestionView } from "@/components/question-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { explainMiss } from "@/lib/qingyan/ai";
import { answerLabel } from "@/lib/qingyan/grade";
import { selectableOptionIds } from "@/lib/qingyan/frame";
import { buildQueue, resumeKey } from "@/lib/qingyan/queue";
import { playSfx, preloadSfx, setSfxMuted, sfxMuted, unlockSfx } from "@/lib/qingyan/sfx";
import { useQingyan } from "@/lib/qingyan/store";
import type { PracticeMode } from "@/lib/qingyan/types";
import { MODE_LABEL } from "@/lib/qingyan/types";
import { cn } from "@/lib/utils";

export function PracticeScreen({
  bankId,
  mode,
  chapter,
}: {
  bankId: string;
  mode: PracticeMode;
  chapter: string;
}) {
  const lib = useQingyan((state) => state.lib);
  const bank = lib.banks.find((item) => item.id === bankId);
  if (!bank) {
    return <h1 className="text-lg font-semibold">题库不在了</h1>;
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
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState(() => ({
    ids: buildQueue(useQingyan.getState().lib, bankId, mode, chapter),
    index: 0,
  }));
  const [chosen, setChosen] = useState<string[]>([]);
  const [phase, setPhase] = useState<"answer" | "reveal">("answer");
  const [log, setLog] = useState<{ id: string; correct: boolean }[]>([]);
  const [note, setNoteText] = useState("");
  const [ai, setAi] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [verdict, setVerdict] = useState<"ok" | "bad" | null>(null);
  const [streak, setStreak] = useState(0);
  const [muted, setMuted] = useState(false);

  const ids = session.ids.filter((id) => lib.questions.some((question) => question.id === id));
  const finished = session.index >= ids.length;
  const question = ids[session.index] ? lib.questions.find((item) => item.id === ids[session.index]) : undefined;

  useEffect(() => {
    let alive = true;
    const apply = () => {
      if (!alive) return;
      const current = useQingyan.getState().lib;
      const saved = current.resume[key];
      if (saved?.ids.length) setSession(saved);
      else setSession({ ids: buildQueue(current, bankId, mode, chapter), index: 0 });
      setBooted(true);
    };
    if (useQingyan.persist.hasHydrated()) apply();
    const unsub = useQingyan.persist.onFinishHydration(() => apply());
    void Promise.resolve(useQingyan.persist.rehydrate()).finally(() => apply());
    return () => {
      alive = false;
      unsub();
    };
  }, [key, bankId, mode, chapter]);

  useEffect(() => {
    if (!booted) return;
    setResume(key, { ids: session.ids, index: session.index });
  }, [booted, key, session.ids, session.index, setResume]);

  useEffect(() => {
    preloadSfx();
    setMuted(sfxMuted());
  }, []);

  useEffect(() => {
    const saved = useQingyan.getState().lib.notes.find((item) => item.questionId === question?.id);
    setNoteText(saved?.text ?? "");
    setAi("");
    setChosen([]);
    setPhase(mode === "recite" ? "reveal" : "answer");
    setVerdict(null);
  }, [question?.id, mode]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!question || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.body.dataset.canvas) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (mode === "recite") return;
      const ids = selectableOptionIds(question.frame, question.choices.map((choice) => choice.id), question.type);
      const index = Number(event.key) - 1;
      if (ids && index >= 0 && index < ids.length && phase === "answer") {
        unlockSfx();
        const id = ids[index]!;
        const many = question.frame ? question.frame.interaction === "choice" && question.frame.select === "many" : question.type === "multi";
        if (many) {
          setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
        } else setChosen([id]);
        playSfx("tap");
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
    setVerdict(correct ? "ok" : "bad");
    playSfx(correct ? "ok" : "bad");
    setStreak((current) => (correct ? current + 1 : 0));
    setPhase("reveal");
  }

  function go(step: number) {
    if (step > 0) playSfx("next");
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

  if (!booted) {
    return <p className="text-muted">正在翻开这套题。</p>;
  }

  if (!ids.length || (finished && !question)) {
    const correct = log.filter((item) => item.correct).length;
    return (
      <div className="mx-auto w-full max-w-xl">
        <p className="text-sm text-muted">{bankName} · {MODE_LABEL[mode]}</p>
        <h1 className="mt-2 text-lg font-semibold">{ids.length === 0 ? "这一轮没有题目" : "这一轮结束了"}</h1>
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
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-4" onPointerDown={unlockSfx}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{bankName} · {MODE_LABEL[mode]}{streak > 1 ? ` · 连对 ${streak}` : ""}</p>
          <p className="mt-1 tabular-nums text-sm text-muted">
            {Math.min(session.index + 1, ids.length)} / {ids.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="q-bar w-40">
            <span style={{ width: `${Math.min(100, (session.index / ids.length) * 100)}%` }} />
          </div>
          <button
            type="button"
            className="canvas-icon"
            aria-label={muted ? "打开音效" : "关闭音效"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setSfxMuted(next);
              if (!next) playSfx("tap");
            }}
          >
            <img src={muted ? "/cc/icons/mute.svg" : "/cc/icons/speaker.svg"} alt="" />
          </button>
        </div>
      </div>
      <QuestionView
        key={question.id}
        question={question}
        chosen={mode === "recite" ? question.answer : chosen}
        onChange={setChosen}
        revealed={phase === "reveal" || mode === "recite"}
        favorite={lib.favorites.includes(question.id)}
        onFavorite={() => toggleFavorite(question.id)}
        verdict={verdict}
      />
      {phase === "reveal" || mode === "recite" ? (
        <div className="aero-float p-4">
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
      <div className="dock aero-float">
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
          <Button type="button" className="min-w-36 flex-1" onClick={() => grade()} disabled={chosen.join("").trim().length === 0}>
            提交
          </Button>
        ) : (
          <Button type="button" className="min-w-36 flex-1" onClick={() => (session.index + 1 >= ids.length ? setSession((s) => ({ ...s, index: ids.length })) : go(1))}>
            继续
          </Button>
        )}
        {mode === "recite" ? (
          <Button type="button" variant="ghost" onClick={() => go(1)}>
            跳过
          </Button>
        ) : null}
        <button type="button" className="ml-auto text-sm text-muted" onClick={restart}>
          重新开始
        </button>
      </div>
      <p className="text-xs leading-5 text-muted">
        数字键选题，回车提交。音效 Kenney（CC0）。图标 game-icons.net（CC BY 3.0，Lorc、Delapouite、sbed、Carl Olsen；浅色界面改为深色，深色界面用原色）。
      </p>
      <Link to="/banks/$bankId" params={{ bankId }} className={cn("text-sm text-muted")}>
        返回这本
      </Link>
    </div>
  );
}
