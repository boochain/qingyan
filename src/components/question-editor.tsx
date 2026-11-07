import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import type { QType, Question } from "@/lib/qingyan/types";
import { TYPE_LABEL } from "@/lib/qingyan/types";

const TYPES: QType[] = ["single", "multi", "judge", "blank", "short"];

export function QuestionEditor({
  bankId,
  bankName,
  question,
  open,
  onOpenChange,
}: {
  bankId: string;
  bankName: string;
  question: Question | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/80" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[88vh] w-[min(40rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface p-5">
          {open ? (
            <EditorForm
              key={question?.id ?? "new"}
              bankId={bankId}
              bankName={bankName}
              question={question}
              onDone={() => onOpenChange(false)}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditorForm({
  bankId,
  bankName,
  question,
  onDone,
}: {
  bankId: string;
  bankName: string;
  question: Question | null;
  onDone: () => void;
}) {
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const chapters = lib.chapters.filter((chapter) => chapter.bankId === bankId);
  const [type, setType] = useState<QType>(question?.type ?? "single");
  const [chapter, setChapter] = useState(
    chapters.find((item) => item.id === question?.chapterId)?.name ?? chapters[0]?.name ?? "未分章",
  );
  const [stem, setStem] = useState(question?.stem ?? "");
  const [choices, setChoices] = useState<string[]>(
    question && question.choices.length
      ? question.choices.map((choice) => choice.text)
      : ["", "", "", ""],
  );
  const [picked, setPicked] = useState<string[]>(() => {
    if (!question) return [];
    if (question.type === "judge") return question.answer;
    if (question.type === "single" || question.type === "multi") {
      return question.answer.map((id) => {
        const index = question.choices.findIndex((choice) => choice.id === id);
        return index >= 0 ? String.fromCharCode(65 + index) : id;
      });
    }
    return question.answer;
  });
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? 2);
  const [tags, setTags] = useState(question?.tags.join("，") ?? "");

  function toggleLetter(letter: string) {
    if (type === "multi") {
      setPicked((current) => (current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter]));
      return;
    }
    setPicked([letter]);
  }

  function save() {
    const filled = choices.map((item) => item.trim()).filter(Boolean);
    const answer =
      type === "judge"
        ? picked[0] === "F" ? "错" : "对"
        : type === "single" || type === "multi"
          ? picked
          : picked[0] ?? "";
    const results = apply([
      {
        op: "question.upsert",
        id: question?.id,
        bank: bankName || bankId,
        chapter,
        type,
        stem,
        choices: filled,
        answer,
        explanation,
        difficulty,
        tags,
        source: question?.source ?? "手工",
      },
    ]);
    const result = results[0];
    if (!result?.ok) {
      toast.error(result?.message ?? "没写上");
      return;
    }
    toast.success(question ? "已更新这道题" : "已加进题库");
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <Dialog.Title className="font-display text-2xl">{question ? "改这道题" : "新的一道题"}</Dialog.Title>
      <Dialog.Description className="text-sm text-muted">选择题点字母当作答案。填空和简答直接写可接受的答案或关键词。</Dialog.Description>
      <label className="flex flex-col gap-2 text-sm">
        题型
        <select value={type} onChange={(event) => setType(event.target.value as QType)}>
          {TYPES.map((item) => (
            <option key={item} value={item}>
              {TYPE_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm">
        章节
        <input value={chapter} onChange={(event) => setChapter(event.target.value)} list="chapter-names" />
        <datalist id="chapter-names">
          {chapters.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-2 text-sm">
        题干
        <textarea value={stem} onChange={(event) => setStem(event.target.value)} />
      </label>
      {type === "single" || type === "multi" ? (
        <div className="flex flex-col gap-2">
          {choices.map((choice, index) => {
            const letter = String.fromCharCode(65 + index);
            return (
              <div key={letter} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`grid size-11 shrink-0 place-items-center rounded-md border ${picked.includes(letter) ? "border-primary bg-primary text-primary-fg" : "border-line"}`}
                  onClick={() => toggleLetter(letter)}
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
      {type === "judge" ? (
        <div className="flex gap-2">
          {[["T", "正确"], ["F", "错误"]].map(([id, label]) => (
            <Button key={id} type="button" variant={picked[0] === id ? "primary" : "surface"} onClick={() => setPicked([id])}>
              {label}
            </Button>
          ))}
        </div>
      ) : null}
      {type === "blank" || type === "short" ? (
        <label className="flex flex-col gap-2 text-sm">
          {type === "blank" ? "可接受答案，多个用 | 分开" : "评分关键词，多个用 | 分开"}
          <input value={picked.join("|")} onChange={(event) => setPicked([event.target.value])} />
        </label>
      ) : null}
      <label className="flex flex-col gap-2 text-sm">
        解析
        <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((level) => (
          <Button key={level} type="button" variant={difficulty === level ? "primary" : "surface"} onClick={() => setDifficulty(level as 1 | 2 | 3)}>
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
        <Button type="button" onClick={save}>
          保存
        </Button>
      </div>
    </div>
  );
}
