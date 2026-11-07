import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQingyan } from "@/lib/qingyan/store";
import { accuracyOf, lastDays } from "@/lib/qingyan/stats";
import { TYPE_LABEL, type QType } from "@/lib/qingyan/types";

export const Route = createFileRoute("/stats")({ component: StatsPage });

function StatsPage() {
  const lib = useQingyan((state) => state.lib);
  const days = lastDays(lib.attempts);
  const total = lib.attempts.length;
  const rate = accuracyOf(lib.attempts);
  const types = (Object.keys(TYPE_LABEL) as QType[]).map((type) => {
    const related = lib.attempts.filter((attempt) => lib.questions.find((q) => q.id === attempt.questionId)?.type === type);
    return { type, label: TYPE_LABEL[type], count: related.length, rate: accuracyOf(related) };
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl">统计</h1>
        <p className="mt-2 text-muted">只统计这台浏览器里留下的作答。换浏览器之前先导出。</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label="作答" value={`${total}`} />
        <Tile label="正确率" value={rate === null ? "—" : `${rate}%`} />
        <Tile label="未掌握" value={`${lib.wrongs.filter((item) => !item.mastered).length}`} />
      </section>
      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="font-display text-xl">近 14 天</h2>
        <div className="mt-4 h-56">
          {total === 0 ? (
            <p className="text-sm text-muted">还没有柱子。去做几题，这里才会长出来。</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 8,
                    color: "var(--color-fg)",
                  }}
                />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-lg border border-line bg-surface p-4">
          <h2 className="font-display text-xl">按题库</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {lib.banks.map((bank) => {
              const attempts = lib.attempts.filter((item) => item.bankId === bank.id);
              const bankRate = accuracyOf(attempts);
              return (
                <li key={bank.id}>
                  <div className="flex justify-between text-sm">
                    <span>{bank.name}</span>
                    <span className="tabular-nums text-muted">{bankRate === null ? "未练" : `${bankRate}% · ${attempts.length}`}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-bg">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${bankRate ?? 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
        <article className="rounded-lg border border-line bg-surface p-4">
          <h2 className="font-display text-xl">按题型</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {types.map((item) => (
              <li key={item.type} className="flex justify-between text-sm">
                <span>{item.label}</span>
                <span className="tabular-nums text-muted">{item.rate === null ? "—" : `${item.rate}%`} · {item.count}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
    </article>
  );
}
