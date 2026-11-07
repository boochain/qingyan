import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import { accuracyOf, greeting, streakDays, todayCount, unmasteredCount } from "@/lib/qingyan/stats";
import type { PracticeMode } from "@/lib/qingyan/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Desk });

function Desk() {
  const lib = useQingyan((state) => state.lib);
  const setDailyGoal = useQingyan((state) => state.setDailyGoal);
  const done = todayCount(lib.attempts);
  const streak = streakDays(lib.attempts);
  const rate = accuracyOf(lib.attempts);
  const wrongs = unmasteredCount(lib);
  const last = lib.attempts[lib.attempts.length - 1];
  const lastBank = lib.banks.find((bank) => bank.id === last?.bankId) ?? lib.banks[0];
  const continueMode: PracticeMode =
    last && last.mode !== "paper" && last.mode !== "favorite" ? last.mode : "order";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm text-primary">青砚 · 只服务这一张书桌</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">{greeting()}的题</h1>
        <p className="mt-3 max-w-2xl text-muted">
          顺序刷、随机抽、限时成卷，错的会自己留下来。要改题，对 Agent 说人话，或者把整库 JSON 交给它。
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="今日"
          value={`${done}`}
          hint={`/ ${lib.dailyGoal} 题`}
          extra={
            <label className="mt-3 flex items-center gap-2 text-xs text-muted">
              目标
              <input
                className="w-16 min-h-11"
                type="number"
                min={5}
                max={200}
                value={lib.dailyGoal}
                onChange={(event) => setDailyGoal(Number(event.target.value))}
              />
            </label>
          }
        />
        <Stat label="连续" value={`${streak}`} hint="天" />
        <Stat label="正确率" value={rate === null ? "—" : `${rate}`} hint={rate === null ? "还没开始" : "%"} />
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm text-muted">接着做</p>
          {lastBank ? (
            <>
              <h2 className="mt-2 font-display text-2xl">{lastBank.name}</h2>
              <p className="mt-2 text-sm text-muted">{lastBank.description}</p>
              <Link
                to="/practice/$bankId"
                params={{ bankId: lastBank.id }}
                search={{ mode: continueMode === "chapter" ? "order" : continueMode, chapter: "" }}
                className={cn(buttonVariants(), "mt-5")}
              >
                继续练习
              </Link>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-2xl">还没有题库</h2>
              <p className="mt-2 text-sm text-muted">可以从示例开始，也可以把旧题导进来。</p>
              <Link to="/banks" className={cn(buttonVariants(), "mt-5")}>
                去建题库
              </Link>
            </>
          )}
        </article>
        <article className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm text-muted">错题还没收口</p>
          <h2 className="mt-2 font-display text-2xl tabular-nums">{wrongs}</h2>
          <p className="mt-2 text-sm text-muted">连续做对两次，就从这里拿走。收藏和笔记也在同一页。</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/wrongs" className={buttonVariants({ variant: "surface" })}>
              打开错题本
            </Link>
            {lastBank ? (
              <Link
                to="/practice/$bankId"
                params={{ bankId: lastBank.id }}
                search={{ mode: "wrong", chapter: "" }}
                className={buttonVariants({ variant: "ghost" })}
              >
                只练错题
              </Link>
            ) : null}
          </div>
        </article>
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-2xl">题库</h2>
          <Link to="/banks" className="text-sm text-muted">
            全部
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {lib.banks.map((bank) => {
            const count = lib.questions.filter((question) => question.bankId === bank.id).length;
            return (
              <Link
                key={bank.id}
                to="/banks/$bankId"
                params={{ bankId: bank.id }}
                className="rounded-lg border border-line bg-surface p-5 hover:border-muted"
              >
                <p className="text-xs text-muted">{bank.subject}</p>
                <h3 className="mt-1 font-display text-xl">{bank.name}</h3>
                <p className="mt-2 text-sm tabular-nums text-muted">{count} 题</p>
              </Link>
            );
          })}
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>示例题可以整库换掉。</span>
        <ClearDemo />
      </div>
    </div>
  );
}

function ClearDemo() {
  const resetDemo = useQingyan((state) => state.resetDemo);
  const clearAll = useQingyan((state) => state.clearAll);
  return (
    <span className="ml-2 inline-flex gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => { if (confirm("清空这台浏览器里的全部题库和记录？")) clearAll(); }}>
        清空，从零开始
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => resetDemo()}>
        恢复示例
      </Button>
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  extra,
}: {
  label: string;
  value: string;
  hint: string;
  extra?: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">
        {value}
        <span className="ml-2 text-base text-muted">{hint}</span>
      </p>
      {extra}
    </article>
  );
}
