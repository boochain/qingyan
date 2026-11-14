import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FreeCanvas } from "@/components/free-canvas";
import {
  collectImages,
  gradeFrame,
  regionHit,
  tokenizeRich,
  type GradeReport,
  type ItemFrame,
  type RichPiece,
} from "@/lib/qingyan/frame";
import { playSfx } from "@/lib/qingyan/sfx";
import type { Question } from "@/lib/qingyan/types";
import { typeLabelOf } from "@/lib/qingyan/types";
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
  verdict,
}: {
  question: Question;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  favorite?: boolean;
  onFavorite?: () => void;
  indexLabel?: string;
  verdict?: "ok" | "bad" | null;
}) {
  const frame = question.frame ?? null;
  const images = useMemo(
    () => collectImages(frame, question.stem, question.explanation),
    [frame, question.stem, question.explanation],
  );
  const report = revealed && frame ? gradeFrame(frame, chosen) : null;
  const [focus, setFocus] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<number | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    setFocus(null);
    setArmed(null);
    setCanvas(null);
  }, [question.id]);

  useEffect(() => {
    if (!revealed || !frame) return;
    const result = gradeFrame(frame, chosen);
    const bad = result.parts.find((part) => !part.ok);
    setFocus(bad?.target ?? result.parts[0]?.target ?? null);
    // Only when the card is revealed or the question changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, question.id]);

  useEffect(() => {
    if (!focus || !revealed) return;
    document.getElementById(`exp-${cssId(focus)}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focus, revealed]);

  useEffect(() => {
    if (revealed || !frame || frame.interaction !== "order") return;
    if (chosen.length === frame.items.length) return;
    onChange(seedOrder(frame, question.id));
  }, [question.id, revealed, frame, chosen.length, onChange]);

  function openImage(src: string) {
    const index = Math.max(0, images.findIndex((item) => item.src === src));
    setCanvas(index);
    playSfx("open");
  }

  const hard = question.difficulty === 1 ? "易" : question.difficulty === 3 ? "难" : "中";
  const explainBits = frame ? flattenExplain(frame) : [];

  return (
    <article className={cn("q-card", verdict === "bad" && "is-bad", verdict === "ok" && "is-ok")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {indexLabel ? <span className="tabular-nums">{indexLabel}</span> : null}
          <span className="rounded-md border border-line px-2 py-1">{typeLabelOf(question)}</span>
          <span>{hard}</span>
          {question.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        {onFavorite ? (
          <button type="button" className="canvas-icon" onClick={onFavorite} aria-label={favorite ? "取消收藏" : "收藏"}>
            <img src="/cc/icons/star-medal.svg" alt="" className={cn("transition-[opacity,scale] duration-200", favorite ? "scale-100 opacity-100" : "scale-90 opacity-40")} />
          </button>
        ) : null}
      </div>
      {frame ? (
        <Play
          frame={frame}
          title={question.stem}
          chosen={chosen}
          onChange={onChange}
          revealed={revealed}
          report={report}
          armed={armed}
          setArmed={setArmed}
          onFocus={setFocus}
          onImage={openImage}
        />
      ) : (
        <Legacy question={question} chosen={chosen} onChange={onChange} revealed={revealed} onImage={openImage} />
      )}
      {revealed ? (
        <div className="explain-stack mt-5 flex flex-col gap-2">
          {frame ? (
            explainBits.map((bit) => {
              const part = report?.parts.find((item) => item.target === bit.target);
              const on = focus === bit.target;
              return (
                <article
                  key={bit.target + bit.bit.text}
                  id={`exp-${cssId(bit.target)}`}
                  className={cn("exp", on && "exp-on", part ? (part.ok ? "exp-ok" : "exp-bad") : "")}
                >
                  <p className="text-xs text-muted">
                    {bit.label}
                    {part ? (part.ok ? " · 正确" : " · 不正确") : ""}
                  </p>
                  {bit.bit.text ? <p className="mt-1 whitespace-pre-wrap">{bit.bit.text}</p> : null}
                  {bit.bit.image ? (
                    <button type="button" className="thumb mt-2" onClick={() => openImage(bit.bit.image!)}>
                      <img src={bit.bit.image} alt={bit.bit.alt || "解析图片"} />
                    </button>
                  ) : null}
                  {part && !part.ok ? (
                    <p className="mt-1 text-xs text-muted">期望 {part.expect}，你的是 {part.got}</p>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="exp">
              <p>
                <span className="text-muted">参考答案 </span>
                {answerLabel(question)}
              </p>
              {question.explanation ? <Rich text={question.explanation} onImage={openImage} /> : null}
            </div>
          )}
        </div>
      ) : null}
      {canvas !== null && images[canvas] ? (
        <FreeCanvas
          images={images}
          index={canvas}
          onIndex={setCanvas}
          onClose={() => {
            playSfx("close");
            setCanvas(null);
          }}
          pick={
            frame?.interaction === "hotspot" && !revealed
              ? (x, y) => {
                  const point = `${clamp01(x).toFixed(3)},${clamp01(y).toFixed(3)}`;
                  onChange(frame.select === "many" ? [...chosen.filter((item) => item.includes(",")), point] : [point]);
                  playSfx("tap");
                }
              : null
          }
          mark={pointOf(chosen)}
          regions={revealed && frame?.interaction === "hotspot" ? frame.regions : undefined}
        />
      ) : null}
    </article>
  );
}

function Play({
  frame,
  title,
  chosen,
  onChange,
  revealed,
  report,
  armed,
  setArmed,
  onFocus,
  onImage,
}: {
  frame: ItemFrame;
  title: string;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  report: GradeReport | null;
  armed: string | null;
  setArmed: (id: string | null) => void;
  onFocus: (id: string) => void;
  onImage: (src: string) => void;
}) {
  const stem = frame.stem || title;
  return (
    <div className="mt-4 flex flex-col gap-4">
      {frame.interaction === "material" ? <h2 className="text-base font-medium leading-7">{title}</h2> : null}
      <Rich
        text={stem}
        code={frame.stemCode}
        onImage={onImage}
        blank={(id) => blankControl(frame, id, chosen, onChange, revealed, onFocus)}
        span={(id, text) => spanControl(frame, id, text, chosen, onChange, revealed, onFocus)}
      />
      {frame.image && frame.interaction !== "hotspot" ? (
        <Figure src={frame.image} alt={frame.imageAlt || "题目图片"} credit={frame.imageCredit} onOpen={() => onImage(frame.image)} />
      ) : null}
      {frame.audio ? <StemAudio src={frame.audio} title={frame.audioTitle} credit={frame.audioCredit} /> : null}
      {frame.interaction === "hotspot" ? (
        <Hotspot frame={frame} chosen={chosen} onChange={onChange} revealed={revealed} onImage={onImage} onFocus={onFocus} />
      ) : null}
      {frame.interaction === "choice" || frame.interaction === "judge" ? (
        <ChoiceList frame={frame} chosen={chosen} onChange={onChange} revealed={revealed} report={report} onFocus={onFocus} onImage={onImage} />
      ) : null}
      {frame.interaction === "slots" ? (
        <SlotPool frame={frame} chosen={chosen} onChange={onChange} revealed={revealed} onFocus={onFocus} />
      ) : null}
      {frame.interaction === "order" ? (
        <OrderList frame={frame} chosen={chosen} onChange={onChange} revealed={revealed} onFocus={onFocus} />
      ) : null}
      {frame.interaction === "pairs" ? (
        <Pairs frame={frame} chosen={chosen} onChange={onChange} revealed={revealed} armed={armed} setArmed={setArmed} onFocus={onFocus} />
      ) : null}
      {frame.interaction === "bins" ? (
        <Bins frame={frame} chosen={chosen} onChange={onChange} revealed={revealed} armed={armed} setArmed={setArmed} onFocus={onFocus} />
      ) : null}
      {frame.interaction === "matrix" ? (
        <Matrix frame={frame} chosen={chosen} onChange={onChange} revealed={revealed} onFocus={onFocus} />
      ) : null}
      {frame.interaction === "numeric" ? (
        <label className="flex flex-col gap-2 text-sm">
          填数字
          <input
            inputMode="decimal"
            disabled={revealed}
            value={chosen[0] ?? ""}
            onChange={(event) => onChange([event.target.value])}
          />
        </label>
      ) : null}
      {frame.interaction === "free" ? (
        <textarea disabled={revealed} value={chosen[0] ?? ""} placeholder="写下回答" onChange={(event) => onChange([event.target.value])} />
      ) : null}
      {frame.interaction === "custom"
        ? frame.fields.map((field) => (
            <FieldControl key={field.id} frame={frame} fieldId={field.id} chosen={chosen} onChange={onChange} revealed={revealed} onFocus={onFocus} />
          ))
        : null}
      {frame.interaction === "material"
        ? frame.subs.map((sub, index) => (
            <section key={sub.id} className="rounded-md border border-line p-3">
              <p className="text-xs text-muted">第 {index + 1} 问 · {sub.typeName}</p>
              <Play
                frame={sub}
                title={sub.stem}
                chosen={readSub(chosen, sub.id)}
                onChange={(next) => onChange(writeSub(chosen, sub.id, next))}
                revealed={revealed}
                report={null}
                armed={armed}
                setArmed={setArmed}
                onFocus={(id) => onFocus(id === "*" ? sub.id : `${sub.id}@${id}`)}
                onImage={onImage}
              />
            </section>
          ))
        : null}
    </div>
  );
}

function Legacy({
  question,
  chosen,
  onChange,
  revealed,
  onImage,
}: {
  question: Question;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  onImage: (src: string) => void;
}) {
  const correct = new Set(question.answer);
  const picked = new Set(chosen);
  function toggle(id: string) {
    if (revealed) return;
    playSfx("tap");
    if (question.type === "multi") onChange(picked.has(id) ? chosen.filter((item) => item !== id) : [...chosen, id]);
    else onChange([id]);
  }
  return (
    <>
      <div className="mt-4">
        <Rich text={question.stem} onImage={onImage} />
      </div>
      {question.type === "single" || question.type === "multi" || question.type === "judge" ? (
        <div className="mt-4 flex flex-col gap-2">
          {question.choices.map((choice, index) => {
            const on = picked.has(choice.id);
            const isAnswer = correct.has(choice.id);
            const state = revealed ? (isAnswer ? "ok" : on ? "bad" : "idle") : on ? "on" : "idle";
            return (
              <button key={choice.id} type="button" disabled={revealed} className={cn("duo", `is-${state}`)} onClick={() => toggle(choice.id)}>
                <span className="duo-letter">{question.type === "judge" ? "" : String.fromCharCode(65 + index)}</span>
                <span>{choice.text}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <textarea
          className="mt-4"
          disabled={revealed}
          placeholder={question.type === "blank" ? "填写答案" : "写下你的回答"}
          value={chosen[0] ?? ""}
          onChange={(event) => onChange([event.target.value])}
        />
      )}
    </>
  );
}

function ChoiceList({
  frame,
  chosen,
  onChange,
  revealed,
  onFocus,
  onImage,
}: {
  frame: ItemFrame;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  report: GradeReport | null;
  onFocus: (id: string) => void;
  onImage: (src: string) => void;
}) {
  const many = frame.interaction === "choice" && frame.select === "many";
  return (
    <div className="flex flex-col gap-2">
      {frame.options.map((opt) => {
        const on = chosen.includes(opt.id);
        const answer = frame.key.includes(opt.id);
        const state = revealed ? (answer ? "ok" : on ? "bad" : "idle") : on ? "on" : "idle";
        return (
          <div key={opt.id} className="flex items-stretch gap-2">
            <button
              type="button"
              disabled={false}
              className={cn("duo flex-1", `is-${state}`)}
              onClick={() => {
                if (revealed) {
                  onFocus(opt.id);
                  return;
                }
                playSfx("tap");
                if (many) onChange(on ? chosen.filter((id) => id !== opt.id) : [...chosen, opt.id]);
                else onChange([opt.id]);
              }}
            >
              <span className="duo-letter">{opt.id}</span>
              <span>{opt.text}</span>
              {revealed && answer ? <img src="/cc/icons/check-mark.svg" alt="" className="ml-auto size-4 opacity-80" /> : null}
              {revealed && on && !answer ? <img src="/cc/icons/cross-mark.svg" alt="" className="ml-auto size-4 opacity-80" /> : null}
            </button>
            {opt.image ? (
              <button type="button" className="thumb" onClick={() => onImage(opt.image!)} aria-label={`查看${opt.alt || opt.text}`}>
                <img src={opt.image} alt={opt.alt || opt.text} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function blankControl(
  frame: ItemFrame,
  id: string,
  chosen: string[],
  onChange: (next: string[]) => void,
  revealed: boolean,
  onFocus: (id: string) => void,
): ReactNode {
  const local = frame.blankOptions[id];
  const value = tokenMap(chosen).get(id) ?? "";
  const expect = tokenMap(frame.key).get(id);
  const ok = revealed && expect ? looseHit(expect, value) : false;
  if (local?.length) {
    return (
      <select
        className={cn("blank-input", revealed && (ok ? "is-ok" : "is-bad"))}
        disabled={revealed}
        value={value}
        onChange={(event) => onChange(setToken(chosen, id, event.target.value))}
        onFocus={() => revealed && onFocus(id)}
      >
        <option value="">选择</option>
        {local.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.text}
          </option>
        ))}
      </select>
    );
  }
  if (frame.interaction === "slots") {
    return (
      <button
        type="button"
        className={cn("blank-chip", value && "is-on", revealed && (ok ? "is-ok" : "is-bad"))}
        onClick={() => {
          if (revealed) onFocus(id);
          else if (value) onChange(setToken(chosen, id, ""));
        }}
      >
        {value ? optionText(frame, value) : id}
      </button>
    );
  }
  return (
    <input
      className={cn("blank-input", revealed && (ok ? "is-ok" : "is-bad"))}
      disabled={revealed}
      value={value}
      placeholder={id}
      onChange={(event) => onChange(setToken(chosen, id, event.target.value))}
      onFocus={() => revealed && onFocus(id)}
    />
  );
}

function spanControl(
  frame: ItemFrame,
  id: string,
  text: string,
  chosen: string[],
  onChange: (next: string[]) => void,
  revealed: boolean,
  onFocus: (id: string) => void,
): ReactNode {
  if (frame.interaction === "patch") {
    const value = tokenMap(chosen).get(id) ?? "";
    const expect = tokenMap(frame.key).get(id);
    const needed = Boolean(expect);
    const ok = revealed && needed && looseHit(expect ?? "", value);
    return (
      <span className={cn("patch", revealed && needed && (ok ? "is-ok" : "is-bad"))}>
        <button type="button" className={cn("span-btn", value && "is-on")} onClick={() => revealed && onFocus(id)}>
          {text}
        </button>
        {!revealed || value ? (
          <input
            className="blank-input"
            disabled={revealed}
            placeholder="改成"
            value={value}
            onChange={(event) => onChange(setToken(chosen, id, event.target.value))}
          />
        ) : null}
      </span>
    );
  }
  const on = chosen.includes(id);
  const answer = frame.key.includes(id);
  const state = revealed ? (answer ? "ok" : on ? "bad" : "idle") : on ? "on" : "idle";
  return (
    <button
      type="button"
      className={cn("span-btn", `is-${state}`)}
      onClick={() => {
        if (revealed) {
          onFocus(id);
          return;
        }
        playSfx("tap");
        onChange(on ? chosen.filter((item) => item !== id) : [...chosen, id]);
      }}
    >
      {text}
    </button>
  );
}

function SlotPool({
  frame,
  chosen,
  onChange,
  revealed,
  onFocus,
}: {
  frame: ItemFrame;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  onFocus: (id: string) => void;
}) {
  const used = new Set([...tokenMap(chosen).values()]);
  return (
    <div className="flex flex-wrap gap-2">
      {frame.options.map((opt) => {
        const taken = frame.unique && used.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            disabled={revealed || taken}
            className={cn("duo duo-chip", taken && "is-idle")}
            onClick={() => {
              const blanks = [...frame.stem.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]!);
              const map = tokenMap(chosen);
              const empty = blanks.find((id) => !map.get(id));
              if (!empty) return;
              playSfx("tap");
              onChange(setToken(chosen, empty, opt.id));
              onFocus(empty);
            }}
          >
            {opt.id}. {opt.text}
          </button>
        );
      })}
    </div>
  );
}

function OrderList({
  frame,
  chosen,
  onChange,
  revealed,
  onFocus,
}: {
  frame: ItemFrame;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  onFocus: (id: string) => void;
}) {
  const ids = chosen.length === frame.items.length ? chosen : frame.items.map((item) => item.id);
  return (
    <div className="flex flex-col gap-2">
      {ids.map((id, index) => {
        const item = frame.items.find((option) => option.id === id);
        const correctIndex = frame.key.indexOf(id);
        const state = revealed ? (correctIndex === index ? "ok" : "bad") : "idle";
        return (
          <div key={id} className={cn("duo", `is-${state}`)}>
            <span className="duo-letter">{index + 1}</span>
            <span className="flex-1 text-left">{item?.text ?? id}</span>
            <button
              type="button"
              className="canvas-icon"
              disabled={revealed || index === 0}
              aria-label="上移"
              onClick={() => {
                playSfx("tap");
                onChange(swap(ids, index, index - 1));
                onFocus(id);
              }}
            >
              <img src="/cc/icons/previous-button.svg" alt="" className="rotate-90" />
            </button>
            <button
              type="button"
              className="canvas-icon"
              disabled={revealed || index === ids.length - 1}
              aria-label="下移"
              onClick={() => {
                playSfx("tap");
                onChange(swap(ids, index, index + 1));
                onFocus(id);
              }}
            >
              <img src="/cc/icons/previous-button.svg" alt="" className="-rotate-90" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Pairs({
  frame,
  chosen,
  onChange,
  revealed,
  armed,
  setArmed,
  onFocus,
}: {
  frame: ItemFrame;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  armed: string | null;
  setArmed: (id: string | null) => void;
  onFocus: (id: string) => void;
}) {
  const links = new Map(chosen.filter((token) => token.includes(">")).map((token) => token.split(">") as [string, string]));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        {frame.left.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("duo", armed === item.id && "is-on", revealed && "is-idle")}
            onClick={() => {
              if (revealed) {
                onFocus(item.id);
                return;
              }
              playSfx("tap");
              setArmed(armed === item.id ? null : item.id);
            }}
          >
            {item.text}
            {links.get(item.id) ? <span className="ml-auto text-xs text-muted">已连</span> : null}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {frame.right.map((item) => (
          <button
            key={item.id}
            type="button"
            className="duo"
            onClick={() => {
              if (revealed || !armed) return;
              playSfx("tap");
              const next = chosen.filter((token) => !token.startsWith(`${armed}>`) && !token.endsWith(`>${item.id}`));
              onChange([...next, `${armed}>${item.id}`]);
              onFocus(armed);
              setArmed(null);
            }}
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bins({
  frame,
  chosen,
  onChange,
  revealed,
  armed,
  setArmed,
  onFocus,
}: {
  frame: ItemFrame;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  armed: string | null;
  setArmed: (id: string | null) => void;
  onFocus: (id: string) => void;
}) {
  const placed = tokenMap(chosen);
  const loose = frame.items.filter((item) => !placed.get(item.id));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {loose.map((item) => (
          <button key={item.id} type="button" className={cn("duo duo-chip", armed === item.id && "is-on")} disabled={revealed} onClick={() => { playSfx("tap"); setArmed(armed === item.id ? null : item.id); }}>
            {item.text}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {frame.bins.map((bin) => (
          <div key={bin.id} className="rounded-md border border-line p-3">
            <button
              type="button"
              className="text-sm text-muted"
              onClick={() => {
                if (!armed || revealed) return;
                playSfx("tap");
                onChange(setToken(chosen, armed, bin.id));
                onFocus(armed);
                setArmed(null);
              }}
            >
              {bin.text}
            </button>
            <div className="mt-2 flex flex-wrap gap-2">
              {frame.items.filter((item) => placed.get(item.id) === bin.id).map((item) => {
                const ok = revealed && tokenMap(frame.key).get(item.id) === bin.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn("duo duo-chip", revealed && (ok ? "is-ok" : "is-bad"))}
                    onClick={() => {
                      if (revealed) onFocus(item.id);
                      else onChange(setToken(chosen, item.id, ""));
                    }}
                  >
                    {item.text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Matrix({
  frame,
  chosen,
  onChange,
  revealed,
  onFocus,
}: {
  frame: ItemFrame;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  onFocus: (id: string) => void;
}) {
  const map = tokenMap(chosen);
  const many = frame.select === "many";
  return (
    <div className="flex flex-col gap-3">
      {frame.rows.map((row) => (
        <div key={row.id}>
          <p className="mb-2 text-sm">{row.text}</p>
          <div className="flex flex-wrap gap-2">
            {frame.cols.map((col) => {
              const token = map.get(row.id) ?? "";
              const on = many ? token.split("+").includes(col.id) : token === col.id;
              const expect = tokenMap(frame.key).get(row.id) ?? "";
              const should = many ? expect.split("+").includes(col.id) : expect === col.id;
              const state = revealed ? (should ? "ok" : on ? "bad" : "idle") : on ? "on" : "idle";
              return (
                <button
                  key={col.id}
                  type="button"
                  disabled={revealed}
                  className={cn("duo duo-chip", `is-${state}`)}
                  onClick={() => {
                    if (revealed) {
                      onFocus(row.id);
                      return;
                    }
                    playSfx("tap");
                    if (!many) onChange(setToken(chosen, row.id, col.id));
                    else {
                      const set = new Set(token.split("+").filter(Boolean));
                      if (set.has(col.id)) set.delete(col.id);
                      else set.add(col.id);
                      onChange(setToken(chosen, row.id, [...set].join("+")));
                    }
                    onFocus(row.id);
                  }}
                >
                  {col.text}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldControl({
  frame,
  fieldId,
  chosen,
  onChange,
  revealed,
  onFocus,
}: {
  frame: ItemFrame;
  fieldId: string;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  onFocus: (id: string) => void;
}) {
  const field = frame.fields.find((item) => item.id === fieldId);
  if (!field) return null;
  const value = tokenMap(chosen).get(field.id) ?? "";
  if (field.kind === "choice" || field.kind === "multi") {
    const many = field.kind === "multi";
    return (
      <div>
        <p className="mb-2 text-sm">{field.prompt}</p>
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => {
            const on = many ? value.split("+").includes(opt.id) : value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={revealed}
                className={cn("duo duo-chip", on && "is-on")}
                onClick={() => {
                  playSfx("tap");
                  if (!many) onChange(setToken(chosen, field.id, opt.id));
                  else {
                    const set = new Set(value.split("+").filter(Boolean));
                    if (set.has(opt.id)) set.delete(opt.id);
                    else set.add(opt.id);
                    onChange(setToken(chosen, field.id, [...set].join("+")));
                  }
                  onFocus(field.id);
                }}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-2 text-sm">
      {field.prompt}
      <input
        disabled={revealed}
        inputMode={field.kind === "number" ? "decimal" : "text"}
        value={value}
        onChange={(event) => onChange(setToken(chosen, field.id, event.target.value))}
        onFocus={() => revealed && onFocus(field.id)}
      />
    </label>
  );
}

function Hotspot({
  frame,
  chosen,
  onChange,
  revealed,
  onImage,
  onFocus,
}: {
  frame: ItemFrame;
  chosen: string[];
  onChange: (next: string[]) => void;
  revealed: boolean;
  onImage: (src: string) => void;
  onFocus: (id: string) => void;
}) {
  const point = pointOf(chosen);
  return (
    <div>
      <div className="relative">
        <img
          src={frame.image}
          alt={frame.imageAlt || "点选图片"}
          className="w-full rounded-md"
          draggable={false}
          onClick={(event) => {
            if (revealed) {
              const hit = frame.regions.find((region) => {
                const rect = event.currentTarget.getBoundingClientRect();
                return regionHit(region, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
              });
              if (hit) onFocus(hit.id);
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            const x = clamp01((event.clientX - rect.left) / rect.width);
            const y = clamp01((event.clientY - rect.top) / rect.height);
            playSfx("tap");
            const token = `${x.toFixed(3)},${y.toFixed(3)}`;
            onChange(frame.select === "many" ? [...chosen.filter((item) => item.includes(",")), token] : [token]);
          }}
        />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {revealed
            ? frame.regions.map((region) => (
                <ellipse
                  key={region.id}
                  cx={region.x * 100}
                  cy={region.y * 100}
                  rx={region.r * 100}
                  ry={region.r * 100}
                  className={frame.key.includes(region.id) ? "mark-region" : "mark-miss"}
                />
              ))
            : null}
          {point ? <circle cx={point.x * 100} cy={point.y * 100} r="1.8" className="mark-you" /> : null}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => onImage(frame.image)}>
          查看附图
        </button>
        {frame.imageCredit ? <span className="text-xs text-muted">{frame.imageCredit}</span> : null}
      </div>
    </div>
  );
}

function Rich({
  text,
  code,
  onImage,
  blank,
  span,
}: {
  text: string;
  code?: boolean;
  onImage: (src: string) => void;
  blank?: (id: string) => ReactNode;
  span?: (id: string, text: string) => ReactNode;
}) {
  const pieces = tokenizeRich(text);
  const body = pieces.map((piece, index) => <Piece key={index} piece={piece} onImage={onImage} blank={blank} span={span} />);
  if (code) return <pre className="overflow-x-auto rounded-md border border-line bg-bg p-3 text-sm">{body}</pre>;
  return <div className="text-base leading-7">{body}</div>;
}

function Piece({
  piece,
  onImage,
  blank,
  span,
}: {
  piece: RichPiece;
  onImage: (src: string) => void;
  blank?: (id: string) => ReactNode;
  span?: (id: string, text: string) => ReactNode;
}) {
  if (piece.k === "text") return <>{piece.v}</>;
  if (piece.k === "br") return <br />;
  if (piece.k === "img") return <Figure src={piece.src} alt={piece.alt} onOpen={() => onImage(piece.src)} />;
  if (piece.k === "audio") return <StemAudio src={piece.src} title={piece.title} />;
  if (piece.k === "blank") return <>{blank ? blank(piece.id) : `（${piece.id}）`}</>;
  if (piece.k === "span") return <>{span ? span(piece.id, piece.v) : piece.v}</>;
  return null;
}

function Figure({ src, alt, credit, onOpen }: { src: string; alt: string; credit?: string; onOpen: () => void }) {
  return (
    <figure className="max-w-xs">
      <button type="button" className="thumb" onClick={onOpen} aria-label="查看附图">
        <img src={src} alt={alt} draggable={false} />
      </button>
      <figcaption className="mt-1 text-xs text-muted">附图，可放大{credit ? ` · ${credit}` : ""}</figcaption>
    </figure>
  );
}

function StemAudio({ src, title, credit }: { src: string; title?: string; credit?: string }) {
  return (
    <div>
      <button
        type="button"
        className="text-sm text-muted underline-offset-2 hover:underline"
        onClick={(event) => {
          playSfx("tap");
          const audio = event.currentTarget.querySelector("audio");
          if (!audio) return;
          audio.currentTime = 0;
          void audio.play();
        }}
      >
        播放{title ? ` ${title}` : "录音"}
        <audio src={src} preload="auto" />
      </button>
      {credit ? <p className="mt-1 text-xs text-muted">{credit}</p> : null}
    </div>
  );
}

function flattenExplain(frame: ItemFrame): { target: string; label: string; bit: ItemFrame["explain"][number] }[] {
  const rows = frame.explain.map((bit) => ({
    target: bit.target,
    label: bit.target === "*" ? "整题" : `对应 ${bit.target}`,
    bit,
  }));
  for (const sub of frame.subs) {
    for (const bit of sub.explain) {
      rows.push({
        target: bit.target === "*" ? sub.id : `${sub.id}@${bit.target}`,
        label: `${sub.typeName} · ${bit.target === "*" ? "这问" : bit.target}`,
        bit,
      });
    }
  }
  return rows;
}

function tokenMap(tokens: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const token of tokens) {
    const index = token.indexOf("=");
    if (index > 0) map.set(token.slice(0, index), token.slice(index + 1));
  }
  return map;
}

function setToken(tokens: string[], id: string, value: string): string[] {
  const next = tokens.filter((token) => !token.startsWith(`${id}=`));
  if (value) next.push(`${id}=${value}`);
  return next;
}

function readSub(tokens: string[], id: string): string[] {
  const prefix = `${id}@`;
  return tokens.filter((token) => token.startsWith(prefix)).map((token) => token.slice(prefix.length));
}

function writeSub(tokens: string[], id: string, inner: string[]): string[] {
  const prefix = `${id}@`;
  return [...tokens.filter((token) => !token.startsWith(prefix)), ...inner.map((token) => `${prefix}${token}`)];
}

function optionText(frame: ItemFrame, id: string): string {
  return frame.options.find((opt) => opt.id === id)?.text ?? id;
}

function looseHit(expect: string, got: string): boolean {
  const value = got.trim().toLowerCase().replace(/\s+/g, "");
  return expect.split("|").some((item) => item.trim().toLowerCase().replace(/\s+/g, "") === value);
}

function pointOf(chosen: string[]): { x: number; y: number } | null {
  for (const token of chosen) {
    const match = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(token.trim());
    if (match) return { x: Number(match[1]), y: Number(match[2]) };
  }
  return null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function swap(ids: string[], from: number, to: number): string[] {
  const next = [...ids];
  const hold = next[from]!;
  next[from] = next[to]!;
  next[to] = hold;
  return next;
}

function seedOrder(frame: ItemFrame, salt: string): string[] {
  const ids = frame.items.map((item) => item.id);
  const ranked = [...ids].sort((a, b) => hash(`${salt}:${a}`) - hash(`${salt}:${b}`));
  if (ranked.join("\0") === frame.key.join("\0")) ranked.reverse();
  return ranked;
}

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (value * 33 + char.charCodeAt(0)) >>> 0;
  return value;
}

function cssId(value: string): string {
  return value.replace(/[^\w\u4e00-\u9fff-]/g, "_");
}
