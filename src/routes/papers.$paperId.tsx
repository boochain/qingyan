import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QuestionView } from "@/components/question-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { isCorrect } from "@/lib/qingyan/grade";
import { useQingyan } from "@/lib/qingyan/store";
import type { ExamResult } from "@/lib/qingyan/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/papers/$paperId")({ component: ExamPage });

function clock(total: number) {
  const safe = Math.max(0, total);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ExamPage() {
  const { paperId } = Route.useParams();
  const lib = useQingyan((state) => state.lib);
  const recordAnswer = useQingyan((state) => state.recordAnswer);
  const paper = lib.papers.find((item) => item.id === paperId);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [left, setLeft] = useState(() => (paper?.durationMin ?? 20) * 60);
  const [result, setResult] = useState<ExamResult | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (!paper) return;
    const raw = sessionStorage.getItem(`qingyan-exam:${paper.id}`);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { answers?: Record<string, string[]>; left?: number };
      if (saved.answers) setAnswers(saved.answers);
      if (typeof saved.left === "number") setLeft(saved.left);
    } catch {
      sessionStorage.removeItem(`qingyan-exam:${paper.id}`);
    }
  }, [paper]);

  useEffect(() => {
    if (!paper || result) return;
    sessionStorage.setItem(`qingyan-exam:${paper.id}`, JSON.stringify({ answers, left }));
  }, [answers, left, paper, result]);

  useEffect(() => {
    if (result) return;
    const timer = window.setInterval(() => setLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [result]);

  useEffect(() => {
    if (left === 0 && paper && !result) submit();
    // submit identity changes every render; the guard is result/left.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  if (!paper) {
    return (
      <div>
        <h1 className="font-display text-3xl">没有这份试卷</h1>
        <Link to="/papers" className={cn(buttonVariants({ variant: "surface" }), "mt-4")}>
          回试卷
        </Link>
      </div>
    );
  }

  const questions = paper.questionIds
    .map((id) => lib.questions.find((question) => question.id === id))
    .filter((question) => question !== undefined);
  const current = questions[index];

  function submit() {
    if (!paper || result || submitted.current) return;
    submitted.current = true;
    const details = questions.map((question) => {
      const chosen = answers[question.id] ?? [];
      const correct = isCorrect(question, chosen);
      recordAnswer(question.id, chosen, "paper");
      return { questionId: question.id, chosen, correct };
    });
    const score = details.filter((item) => item.correct).length;
    const exam: ExamResult = {
      id: `exam_${Date.now().toString(36)}`,
      paperId: paper.id,
      paperName: paper.name,
      score,
      total: details.length,
      durationSec: paper.durationMin * 60 - left,
      at: new Date().toISOString(),
      details,
    };
    useQingyan.setState((state) => ({
      lib: { ...state.lib, exams: [exam, ...state.lib.exams].slice(0, 100) },
    }));
    sessionStorage.removeItem(`qingyan-exam:${paper.id}`);
    setResult(exam);
  }

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <p className="text-sm text-muted">{paper.name}</p>
          <h1 className="mt-2 font-display text-4xl tabular-nums">
            {result.score}
            <span className="text-2xl text-muted"> / {result.total}</span>
          </h1>
          <p className="mt-2 text-muted">用时 {clock(result.durationSec)}。错题已经记进错题本。</p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Link to="/wrongs" className={buttonVariants()}>
            去看错题
          </Link>
          <Link to="/papers" className={buttonVariants({ variant: "surface" })}>
            回试卷
          </Link>
        </div>
        <ul className="flex flex-col gap-4">
          {result.details.map((detail, detailIndex) => {
            const question = questions.find((item) => item.id === detail.questionId);
            if (!question) return null;
            return (
              <li key={detail.questionId}>
                <p className={cn("mb-2 text-sm", detail.correct ? "text-moss" : "text-primary")}>
                  {detailIndex + 1}. {detail.correct ? "对" : "错"}
                </p>
                <QuestionView question={question} chosen={detail.chosen} onChange={() => undefined} revealed />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">限时作答 · 交卷前不公布答案</p>
          <h1 className="mt-1 font-display text-3xl">{paper.name}</h1>
        </div>
        <p className={cn("font-display text-3xl tabular-nums", left < 60 ? "text-primary" : "text-fg")}>{clock(left)}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, questionIndex) => {
          const filled = (answers[question.id] ?? []).some((item) => item.trim());
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => setIndex(questionIndex)}
              className={cn(
                "grid size-11 place-items-center rounded-md border text-sm tabular-nums",
                questionIndex === index ? "border-primary bg-primary text-primary-fg" : filled ? "border-moss text-moss" : "border-line text-muted",
              )}
            >
              {questionIndex + 1}
            </button>
          );
        })}
      </div>
      {current ? (
        <QuestionView
          question={current}
          chosen={answers[current.id] ?? []}
          onChange={(next) => setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: next }))}
          revealed={false}
          indexLabel={`${index + 1} / ${questions.length}`}
        />
      ) : (
        <p className="text-muted">卷里的题被删光了。</p>
      )}
      <div className="sticky bottom-16 flex flex-wrap gap-2 border-t border-line bg-bg/95 py-3 md:bottom-0">
        <Button type="button" variant="ghost" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
          上一题
        </Button>
        <Button type="button" variant="surface" disabled={index >= questions.length - 1} onClick={() => setIndex((value) => value + 1)}>
          下一题
        </Button>
        <Button type="button" onClick={submit}>
          交卷
        </Button>
      </div>
    </div>
  );
}
