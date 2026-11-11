import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import { relTime } from "@/lib/qingyan/stats";

export function PapersScreen() {
  const lib = useQingyan((state) => state.lib);
  const apply = useQingyan((state) => state.apply);
  const navigate = useNavigate();
  const [name, setName] = useState("随堂小卷");
  const [bankId, setBankId] = useState(lib.banks[0]?.id ?? "");
  const [from, setFrom] = useState<"bank" | "wrong">("bank");
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(20);

  function createPaper() {
    const bank = lib.banks.find((item) => item.id === bankId);
    const results = apply([
      {
        op: "paper.create",
        name,
        bank: bank?.name ?? bankId,
        from,
        count,
        durationMin: minutes,
      },
    ]);
    const result = results[0];
    if (!result?.ok || !result.id) {
      toast.error(result?.message ?? "没有抽成卷");
      return;
    }
    void navigate({ to: "/papers/$paperId", params: { paperId: result.id } });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header>
        <h1 className="text-lg font-semibold">试卷</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">先组卷，再限时做。交卷前不看对错，交卷后错题会进错题本。</p>
      </header>
      <form
        className="aero-float grid gap-3 p-5 pad:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          createPaper();
        }}
      >
        <label className="flex flex-col gap-2 text-sm">
          卷名
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          从哪本抽
          <select value={bankId} onChange={(event) => setBankId(event.target.value)}>
            {lib.banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          范围
          <select value={from} onChange={(event) => setFrom(event.target.value as "bank" | "wrong")}>
            <option value="bank">整库随机</option>
            <option value="wrong">未掌握的错题</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-sm">
            题量
            <input type="number" min={1} max={100} value={count} onChange={(event) => setCount(Number(event.target.value))} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            分钟
            <input type="number" min={1} max={240} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
          </label>
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={!lib.banks.length}>
            生成并开考
          </Button>
        </div>
      </form>
      <ul className="flex flex-col gap-2">
        {lib.papers.map((paper) => {
          const last = lib.exams.find((exam) => exam.paperId === paper.id);
          return (
            <li key={paper.id} className="aero-float flex flex-col gap-3 p-4 pad:flex-row pad:items-center pad:justify-between">
              <div>
                <h2 className="text-base font-semibold">{paper.name}</h2>
                <p className="mt-1 text-sm tabular-nums text-muted">
                  {paper.questionIds.length} 题 · {paper.durationMin} 分钟
                  {last ? ` · 上次 ${last.score}/${last.total} · ${relTime(last.at)}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pad:flex">
                <Link to="/papers/$paperId" params={{ paperId: paper.id }} className={buttonVariants()}>
                  开考
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("删除这份试卷？")) apply([{ op: "paper.delete", id: paper.id }]);
                  }}
                >
                  删除
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
