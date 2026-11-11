import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImportActions } from "@/components/import-actions";
import { QuestionForm } from "@/components/question-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import type { Chapter, Question } from "@/lib/qingyan/types";
import { typeLabelOf } from "@/lib/qingyan/types";
import { useLibraryReady } from "@/screens/frame";
import { cn } from "@/lib/utils";

export function EditorScreen({ bankId, q }: { bankId: string; q: string }) {
  const navigate = useNavigate();
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const ready = useLibraryReady();
  const bank = lib.banks.find((item) => item.id === bankId);
  const chapters = lib.chapters.filter((chapter) => chapter.bankId === bankId).sort((a, b) => a.order - b.order);
  const [meta, setMeta] = useState({ name: bank?.name ?? "", subject: bank?.subject ?? "", description: bank?.description ?? "" });
  const [chapterId, setChapterId] = useState("");
  const [newChapter, setNewChapter] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const opened = useRef("");

  useEffect(() => {
    if (!bank) return;
    setMeta({ name: bank.name, subject: bank.subject, description: bank.description });
  }, [bank?.id, bank?.name, bank?.subject, bank?.description]);

  useEffect(() => {
    if (opened.current === q) return;
    if (!q) {
      opened.current = "";
      setEditing(null);
      return;
    }
    if (q === "new") {
      opened.current = "new";
      setDraftKey((value) => value + 1);
      setEditing("new");
      return;
    }
    const found = lib.questions.find((item) => item.id === q && item.bankId === bankId);
    if (!found) return;
    opened.current = q;
    setEditing(found);
    setChapterId(found.chapterId);
  }, [q, bankId, lib.questions]);

  const questions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return lib.questions.filter((question) => {
      if (question.bankId !== bankId) return false;
      if (chapterId && question.chapterId !== chapterId) return false;
      if (!needle) return true;
      return question.stem.toLowerCase().includes(needle) || question.tags.some((tag) => tag.toLowerCase().includes(needle));
    });
  }, [lib.questions, bankId, chapterId, query]);

  function goSearch(next: string) {
    void navigate({ to: "/banks/$bankId/edit", params: { bankId }, search: { q: next }, replace: true });
  }

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

  function saveMeta() {
    const name = meta.name.trim();
    if (!name) {
      toast.error("名称不能空");
      return;
    }
    const results = apply([{ op: "bank.update", id: bankId, name, subject: meta.subject.trim(), description: meta.description.trim() }]);
    if (!results[0]?.ok) toast.error(results[0]?.message ?? "没保存");
    else toast.success("题库信息已保存");
  }

  function addChapter() {
    const name = newChapter.trim();
    if (!name) {
      toast.error("先写章节名");
      return;
    }
    const results = apply([{ op: "chapter.upsert", bank: bankId, name }]);
    if (!results[0]?.ok) toast.error(results[0]?.message ?? "没加上");
    else {
      setNewChapter("");
      if (results[0].id) setChapterId(results[0].id);
      toast.success("章节已加上");
    }
  }

  function renameChapter(id: string) {
    const to = editingName.trim();
    if (!to) return;
    const results = apply([{ op: "chapter.rename", bank: bankId, from: id, to }]);
    if (!results[0]?.ok) toast.error(results[0]?.message ?? "没改成");
    else {
      setEditingId("");
      toast.success("章节已改名");
    }
  }

  function deleteChapter(id: string, name: string) {
    if (!confirm(`删除章节「${name}」？里面的题会改到「未分章」。`)) return;
    const results = apply([{ op: "chapter.delete", bank: bankId, chapter: id }]);
    if (!results[0]?.ok) toast.error(results[0]?.message ?? "没删掉");
    else {
      if (chapterId === id) setChapterId("");
      toast.success(results[0].message);
    }
  }

  function moveChapter(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= chapters.length) return;
    const ordered = chapters.slice();
    const [item] = ordered.splice(index, 1);
    if (!item) return;
    ordered.splice(next, 0, item);
    apply(ordered.map((chapter, order) => ({ op: "chapter.upsert", bank: bankId, name: chapter.name, order })));
  }

  function removeQuestion(question: Question) {
    if (!confirm("删除这道题？")) return;
    const results = apply([{ op: "question.delete", id: question.id }]);
    if (!results[0]?.ok) {
      toast.error(results[0]?.message ?? "没删掉");
      return;
    }
    if (editing && editing !== "new" && editing.id === question.id) {
      opened.current = "";
      setEditing(null);
      goSearch("");
    }
    toast.success("已删除");
  }

  function startNew() {
    if (q === "new") {
      setEditing("new");
      setDraftKey((value) => value + 1);
      return;
    }
    goSearch("new");
  }

  const activeChapter = chapters.find((chapter) => chapter.id === chapterId)?.name ?? "";

  return (
    <div className="flex flex-col gap-3 desk:h-[calc(100dvh-2.5rem)] desk:min-h-0">
      <header className="flex flex-col gap-3 pad:flex-row pad:items-end pad:justify-between">
        <div>
          <Link to="/banks/$bankId" params={{ bankId }} className="text-sm text-muted">
            返回练习
          </Link>
          <h1 className="mt-1 text-xl font-semibold">编辑 · {bank.name}</h1>
        </div>
        <ImportActions fallbackBank={bank.name} importLabel="导入到这本" prominent={false} />
      </header>

      <form
        className={cn(
          "aero-float grid gap-3 p-4 pad:grid-cols-2 desk:grid-cols-[1fr_1fr_1.4fr_auto] desk:items-end",
          editing ? "max-pad:hidden" : "",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          saveMeta();
        }}
      >
        <label className="flex flex-col gap-2 text-sm">
          名称
          <input value={meta.name} onChange={(event) => setMeta((value) => ({ ...value, name: event.target.value }))} />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          科目
          <input value={meta.subject} onChange={(event) => setMeta((value) => ({ ...value, subject: event.target.value }))} />
        </label>
        <label className="flex flex-col gap-2 text-sm pad:col-span-2 desk:col-span-1">
          说明
          <input value={meta.description} onChange={(event) => setMeta((value) => ({ ...value, description: event.target.value }))} />
        </label>
        <div className="pad:col-span-2 desk:col-span-1">
          <Button type="submit" variant="surface" className="w-full desk:w-auto">
            保存题库信息
          </Button>
        </div>
      </form>

      <div className={cn("aero-float p-3 desk:hidden", editing ? "max-pad:hidden" : "")}>
        <div className="chip-row">
          <Chip on={chapterId === ""} label={`全部 ${lib.questions.filter((question) => question.bankId === bankId).length}`} pick={() => setChapterId("")} />
          {chapters.map((chapter) => {
            const count = lib.questions.filter((question) => question.chapterId === chapter.id).length;
            return <Chip key={chapter.id} on={chapterId === chapter.id} label={`${chapter.name} ${count}`} pick={() => setChapterId(chapter.id)} />;
          })}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addChapter();
          }}
        >
          <input value={newChapter} onChange={(event) => setNewChapter(event.target.value)} placeholder="新章节" />
          <Button type="submit" variant="surface" className="shrink-0">
            添加
          </Button>
        </form>
        <ChapterTools
          chapters={chapters}
          chapterId={chapterId}
          editingId={editingId}
          editingName={editingName}
          setEditingId={setEditingId}
          setEditingName={setEditingName}
          renameChapter={renameChapter}
          moveChapter={moveChapter}
          deleteChapter={deleteChapter}
        />
      </div>

      <div className="grid min-h-0 flex-1 items-stretch gap-3 pad:grid-cols-2 desk:grid-cols-[12.5rem_minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <aside className="aero-float hidden min-h-0 flex-col overflow-hidden p-3 desk:flex">
          <h2 className="px-1 text-sm font-semibold">章节</h2>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addChapter();
            }}
          >
            <input value={newChapter} onChange={(event) => setNewChapter(event.target.value)} placeholder="新章节" />
            <Button type="submit" variant="surface">
              添加
            </Button>
          </form>
          <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            <li>
              <button
                type="button"
                className={cn("min-h-11 w-full rounded-xl px-3 text-left text-sm", chapterId === "" ? "gloss gloss-blue" : "text-muted")}
                onClick={() => setChapterId("")}
              >
                全部
              </button>
            </li>
            {chapters.map((chapter) => {
              const count = lib.questions.filter((question) => question.chapterId === chapter.id).length;
              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    className={cn("min-h-11 w-full rounded-xl px-3 text-left text-sm", chapterId === chapter.id ? "gloss gloss-blue" : "text-muted")}
                    onClick={() => setChapterId(chapter.id)}
                  >
                    {chapter.name}
                    <span className="ml-2 tabular-nums">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <ChapterTools
            chapters={chapters}
            chapterId={chapterId}
            editingId={editingId}
            editingName={editingName}
            setEditingId={setEditingId}
            setEditingName={setEditingName}
            renameChapter={renameChapter}
            moveChapter={moveChapter}
            deleteChapter={deleteChapter}
          />
        </aside>

        <section className={cn("aero-float flex min-h-0 flex-col p-4", editing ? "max-pad:hidden" : "")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">题目</h2>
            <Button type="button" onClick={startNew}>
              加一道题
            </Button>
          </div>
          <input className="mt-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜题干或标签" />
          <ul className="mt-3 flex max-h-[70vh] min-h-0 flex-1 flex-col gap-2 overflow-y-auto pad:max-h-[calc(100dvh-20rem)] desk:max-h-none">
            {questions.length === 0 ? <li className="text-sm text-muted">这里还没有题。</li> : null}
            {questions.map((question) => {
              const on = editing !== "new" && editing?.id === question.id;
              const chapter = chapters.find((item) => item.id === question.chapterId);
              return (
                <li key={question.id} className={cn("rounded-2xl border px-3 py-2", on ? "border-primary bg-white/50" : "border-white/70")}>
                  <button type="button" className="w-full text-left" onClick={() => goSearch(question.id)}>
                    <span className="text-xs text-muted">
                      {typeLabelOf(question)}
                      {chapter ? ` · ${chapter.name}` : ""}
                    </span>
                    <span className="mt-1 block line-clamp-3 leading-6">{question.stem}</span>
                  </button>
                  <div className="mt-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeQuestion(question)}>
                      删除
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={cn("aero-float min-h-0 overflow-y-auto p-4", editing ? "" : "max-pad:hidden")}>
          {editing ? (
            <>
              <Button type="button" variant="ghost" className="mb-3 pad:hidden" onClick={() => goSearch("")}>
                返回题目列表
              </Button>
              <QuestionForm
                key={editing === "new" ? `new-${draftKey}` : editing.id}
                bankId={bankId}
                question={editing === "new" ? null : editing}
                initialChapter={activeChapter}
                onDone={() => goSearch("")}
                onSaved={(id) => {
                  const saved = useQingyan.getState().lib.questions.find((item) => item.id === id);
                  if (saved) {
                    setEditing(saved);
                    setChapterId(saved.chapterId);
                  }
                  if (q !== id) {
                    opened.current = id;
                    goSearch(id);
                  }
                }}
              />
            </>
          ) : (
            <p className="text-sm leading-6 text-muted">从题目列表里点一题。当前章节：{activeChapter || "全部"}。</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Chip({ on, label, pick }: { on: boolean; label: string; pick: () => void }) {
  return (
    <button
      type="button"
      onClick={pick}
      className={cn("min-h-11 shrink-0 rounded-full px-3 text-sm", on ? "gloss gloss-blue" : "bg-white/50 text-muted")}
    >
      {label}
    </button>
  );
}

function ChapterTools({
  chapters,
  chapterId,
  editingId,
  editingName,
  setEditingId,
  setEditingName,
  renameChapter,
  moveChapter,
  deleteChapter,
}: {
  chapters: Chapter[];
  chapterId: string;
  editingId: string;
  editingName: string;
  setEditingId: (id: string) => void;
  setEditingName: (name: string) => void;
  renameChapter: (id: string) => void;
  moveChapter: (index: number, direction: -1 | 1) => void;
  deleteChapter: (id: string, name: string) => void;
}) {
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  const chapter = index >= 0 ? chapters[index] : undefined;
  if (!chapter) return <p className="mt-3 px-1 text-xs text-muted">选中一章后可以改名、排序或删除。</p>;
  if (editingId === chapter.id) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <input
          value={editingName}
          onChange={(event) => setEditingName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              renameChapter(chapter.id);
            }
          }}
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => renameChapter(chapter.id)}>
            保存
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId("")}>
            取消
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setEditingId(chapter.id);
          setEditingName(chapter.name);
        }}
      >
        改名
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => moveChapter(index, -1)}>
        上移
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={index === chapters.length - 1} onClick={() => moveChapter(index, 1)}>
        下移
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => deleteChapter(chapter.id, chapter.name)}>
        删除
      </Button>
    </div>
  );
}
