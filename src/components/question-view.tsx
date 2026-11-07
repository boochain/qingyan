import { Star } from "lucide-react";
import type { Question } from "@/lib/qingyan/types";
import { TYPE_LABEL } from "@/lib/qingyan/types";
import { answerLabel } from "@/lib/qingyan/grade";
import { cn } from "@/lib/utils";

export function QuestionView({
  question,
  chosen,
  onChange,
  revealed,
  favorite,
  onFavorite,
  indexLabel,
}: {
  question: Question;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  favorite?: boolean;
  onFavorite?: () => void;
  indexLabel?: string;
}) {
  const correct = new Set(question.answer);
  const picked = new Set(chosen);
  const hard = question.difficulty === 1 ? "易" : question.difficulty === 3 ? "难" : "中";

  function toggle(id: string) {
    if (revealed) return;
    if (question.type === "multi") {
      onChange(picked.has(id) ? chosen.filter((item) => item !== id) : [...chosen, id]);
      return;
    }
    if (question.type === "single" || question.type === "judge") onChange([id]);
  }

  return (
    <article className="rounded-lg border border-line bg-surface p-5 md:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {indexLabel ? <span className="tabular-nums">{indexLabel}</span> : null}
          <span className="rounded-md border border-line px-2 py-1">{TYPE_LABEL[question.type]}</span>
          <span>{hard}</span>
          {question.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        {onFavorite ? (
          <button type="button" className="grid size-11 place-items-center rounded-md hover:bg-surface-2" onClick={onFavorite} aria-label={favorite ? "取消收藏" : "收藏"}>
            <Star className={cn("size-5", favorite ? "fill-primary text-primary" : "text-muted")} />
          </button>
        ) : null}
      </div>
      <h2 className="mt-4 font-display text-2xl leading-snug">{question.stem}</h2>
      {question.type === "single" || question.type === "multi" || question.type === "judge" ? (
        <div className="mt-5 flex flex-col gap-2">
          {question.choices.map((choice, index) => {
            const on = picked.has(choice.id);
            const isAnswer = correct.has(choice.id);
            const state = revealed
              ? isAnswer
                ? "border-moss bg-moss/15"
                : on
                  ? "border-primary bg-primary/10"
                  : "border-line"
              : on
                ? "border-primary bg-primary/10"
                : "border-line hover:border-muted";
            return (
              <button
                key={choice.id}
                type="button"
                disabled={revealed}
                onClick={() => toggle(choice.id)}
                className={cn("flex min-h-11 items-start gap-3 rounded-md border px-3 py-3 text-left", state)}
              >
                <span className="mt-0.5 font-medium tabular-nums text-muted">{String.fromCharCode(65 + index)}</span>
                <span>{choice.text}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <textarea
          className="mt-5"
          placeholder={question.type === "blank" ? "填写答案" : "写下你的回答，点到关键词即可"}
          value={chosen[0] ?? ""}
          disabled={revealed}
          onChange={(event) => onChange([event.target.value])}
        />
      )}
      {revealed ? (
        <div className="mt-5 rounded-md border border-line bg-bg px-4 py-3 text-sm leading-6">
          <p>
            <span className="text-muted">参考答案 </span>
            {answerLabel(question)}
          </p>
          {question.explanation ? <p className="mt-2 text-fg/90">{question.explanation}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
