import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { frameToText } from "@/lib/qingyan/frame";
import { useQingyan } from "@/lib/qingyan/store";
import type { QType, Question } from "@/lib/qingyan/types";
import { TYPE_LABEL } from "@/lib/qingyan/types";

const TYPES: QType[] = ["single", "multi", "judge", "blank", "short", "frame"];
const FRAME_SAMPLE = `@frame
type: 七选五
interaction: slots
unique: yes
stem: 河流{{1}}过山谷。
opt A: 穿过
opt B: 离开
key: 1=A
explain 1: 河道是穿过，不是离开。
@end`;

export function QuestionForm({
  bankId,
  question,
  initialChapter,
  onDone,
  onSaved,
}: {
  bankId: string;
  question: Question | null;
  initialChapter?: string;
  onDone: () => void;
  onSaved?: (id: string) => void;
}) {
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const chapters = lib.chapters.filter((chapter) => chapter.bankId === bankId);
  const [type, setType] = useState<QType>(question?.type ?? "single");
  const [chapter, setChapter] = useState(() => {
    if (initialChapter) return initialChapter;
    if (question) return chapters.find((item) => item.id === question.chapterId)?.name || "未分章";
    return "未分章";
  });
  const [stem, setStem] = useState(question?.stem ?? "");
  const [choices, setChoices] = useState<string[]>(
    question && question.choices.length ? question.choices.map((choice) => choice.text) : ["", "", "", ""],
  );
  const [picked, setPicked] = useState<string[]>(() => {
    if (!question) return [];
    if (question.type === "blank" || question.type === "short") {
      return question.answer.length ? [question.answer.join("|")] : [];
    }
    if (question.type === "judge") return question.answer;
    if (question.type === "single" || question.type === "multi") {
      return question.answer.map((id) => {
        const index = question.choices.findIndex((choice) => choice.id === id);
        return index >= 0 ? String.fromCharCode(65 + index) : id;
      });
    }
    return [];
  });
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(question?.difficulty ?? 2);
  const [tags, setTags] = useState(question?.tags.join("，") ?? "");
  const [frameText, setFrameText] = useState(question?.frame ? frameToText(question.frame) : "");
  const framed = Boolean(frameText.trim()) || type === "frame";

  function toggleLetter(letter: string) {
    if (type === "multi") {
      setPicked((current) => (current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter]));
      return;
    }
    setPicked([letter]);
  }

  function save() {
    const frame = frameText.trim();
    if (!stem.trim() && !frame) {
      toast.error("题干不能空");
      return;
    }
    if (type === "frame" && !frame) {
      toast.error("框架题要把 @frame 写完整");
      return;
    }
    let choicePayload: Array<string | { id: string; text: string }> = [];
    if (!frame && (type === "single" || type === "multi")) {
      let last = choices.length;
      while (last > 0 && !choices[last - 1]?.trim()) last -= 1;
      const kept = choices.slice(0, last);
      if (kept.some((item) => !item.trim())) {
        toast.error("选项要按 A、B、C 连续填写，中间不能留空");
        return;
      }
      if (kept.length < 2) {
        toast.error("选择题至少要两个选项");
        return;
      }
      const letters = new Set(kept.map((_, index) => String.fromCharCode(65 + index)));
      if (!picked.length || picked.some((letter) => !letters.has(letter))) {
        toast.error("先标出答案");
        return;
      }
      choicePayload = kept.map((text, index) => ({
        id: question?.choices[index]?.id || String.fromCharCode(97 + index),
        text: text.trim(),
      }));
    } else if (!frame && type === "judge") {
      if (picked[0] !== "T" && picked[0] !== "F") {
        toast.error("先标出答案");
        return;
      }
    } else if (!frame && (type === "blank" || type === "short") && !(picked[0] ?? "").trim()) {
      toast.error("先写答案");
      return;
    }
    const answer =
      type === "judge" ? (picked[0] === "F" ? "错" : "对") : type === "single" || type === "multi" ? picked : (picked[0] ?? "");
    const results = apply([
      {
        op: "question.upsert",
        id: question?.id,
        bank: bankId,
        chapter: chapter.trim() || "未分章",
        type,
        stem,
        choices: choicePayload,
        answer,
        explanation,
        difficulty,
        tags,
        source: question?.source ?? "手工",
        frame: frame ? frameText : "",
      },
    ]);
    const result = results[0];
    if (!result?.ok) {
      toast.error(result?.message ?? "没写上");
      return;
    }
    toast.success(question ? "已更新这道题" : "已加进题库");
    if (result.id) onSaved?.(result.id);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div>
        <h2 className="text-lg font-semibold">{question ? "改这道题" : "新的一道题"}</h2>
        <p className="mt-1 text-sm text-muted">单选和多选点左侧字母作为答案。怪题把框架写在下面。</p>
      </div>
      <div className="grid gap-4 pad:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          题型
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as QType);
              setPicked([]);
            }}
          >
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {TYPE_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          章节
          <input value={chapter} onChange={(event) => setChapter(event.target.value)} list="qingyan-chapter-names" />
          <datalist id="qingyan-chapter-names">
            {chapters.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm">
        题干
        <textarea value={stem} onChange={(event) => setStem(event.target.value)} />
      </label>
      {framed ? null : type === "single" || type === "multi" ? (
        <div className="flex flex-col gap-2">
          {choices.map((choice, index) => {
            const letter = String.fromCharCode(65 + index);
            return (
              <div key={letter} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`grid size-11 shrink-0 place-items-center rounded-full ${picked.includes(letter) ? "gloss gloss-blue" : "gloss gloss-glass"}`}
                  onClick={() => toggleLetter(letter)}
                  aria-pressed={picked.includes(letter)}
                >
                  {letter}
                </button>
                <input
                  value={choice}
                  placeholder={`选项 ${letter}`}
                  onChange={(event) =>
                    setChoices((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                  }
                />
              </div>
            );
          })}
          {choices.length < 6 ? (
            <Button type="button" variant="ghost" onClick={() => setChoices((current) => [...current, ""])}>
              再加一个选项
            </Button>
          ) : null}
        </div>
      ) : null}
      {framed ? null : type === "judge" ? (
        <div className="flex gap-2">
          {[
            ["T", "正确"],
            ["F", "错误"],
          ].map(([id, label]) => (
            <Button key={id} type="button" variant={picked[0] === id ? "primary" : "surface"} onClick={() => setPicked([id])}>
              {label}
            </Button>
          ))}
        </div>
      ) : null}
      {framed ? null : type === "blank" || type === "short" ? (
        <label className="flex flex-col gap-2 text-sm">
          {type === "blank" ? "可接受答案，多个用 | 分开" : "评分关键词，多个用 | 分开"}
          <input value={picked.join("|")} onChange={(event) => setPicked(event.target.value ? [event.target.value] : [])} />
        </label>
      ) : null}
      <label className="flex flex-col gap-2 text-sm">
        题型框架
        <textarea
          className="min-h-40 font-mono text-sm"
          value={frameText}
          placeholder="留空则用上面的题型。新题型写成 @frame … @end。没有附图就不要写 img。"
          onChange={(event) => setFrameText(event.target.value)}
        />
      </label>
      {!frameText.trim() ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setType("frame");
            setFrameText(FRAME_SAMPLE);
          }}
        >
          填入一个七选五示例
        </Button>
      ) : null}
      <label className="flex flex-col gap-2 text-sm">
        解析
        <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {([1, 2, 3] as const).map((level) => (
          <Button key={level} type="button" variant={difficulty === level ? "primary" : "surface"} onClick={() => setDifficulty(level)}>
            {level === 1 ? "易" : level === 3 ? "难" : "中"}
          </Button>
        ))}
      </div>
      <label className="flex flex-col gap-2 text-sm">
        标签
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="用逗号分开" />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
        <Button type="submit">保存</Button>
      </div>
    </form>
  );
}
