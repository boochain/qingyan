import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { useQingyan } from "@/lib/qingyan/store";
import { accuracyOf, streakDays, todayCount, unmasteredCount } from "@/lib/qingyan/stats";
import type { PracticeMode } from "@/lib/qingyan/types";
import { Screen } from "@/screens/frame";

export function DeskScreen() {
  const lib = useQingyan((state) => state.lib);
  const setDailyGoal = useQingyan((state) => state.setDailyGoal);
  const resetDemo = useQingyan((state) => state.resetDemo);
  const clearAll = useQingyan((state) => state.clearAll);
  const done = todayCount(lib.attempts);
  const streak = streakDays(lib.attempts);
  const rate = accuracyOf(lib.attempts);
  const wrongs = unmasteredCount(lib);
  const last = lib.attempts[lib.attempts.length - 1];
  const bank = lib.banks.find((item) => item.id === last?.bankId) ?? lib.banks[0];
  const mode: PracticeMode = last && last.mode !== "paper" && last.mode !== "favorite" ? last.mode : "order";

  return (
    <Screen title="书桌" lede="接着上次的题。建库和改题在题库里。">
      <ul className="grid list-none grid-cols-2 gap-3 pad:grid-cols-4">
        <Stat label="今日" value={`${done}/${lib.dailyGoal}`} />
        <Stat label="连续" value={`${streak} 天`} />
        <Stat label="正确率" value={rate === null ? "—" : `${rate}%`} />
        <Stat label="未掌握" value={`${wrongs}`} />
      </ul>

      <section className="aero-float p-5">
        <p className="text-sm text-muted">接着做</p>
        {bank ? (
          <>
            <h2 className="mt-1 text-xl font-semibold">{bank.name}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{bank.description || bank.subject}</p>
            <div className="mt-4 grid grid-cols-1 gap-2 pad:flex pad:flex-wrap">
              <Link
                to="/practice/$bankId"
                params={{ bankId: bank.id }}
                search={{ mode: mode === "chapter" ? "order" : mode, chapter: "" }}
                className={buttonVariants({ className: "w-full pad:w-auto" })}
              >
                继续练习
              </Link>
              <Link
                to="/banks/$bankId"
                params={{ bankId: bank.id }}
                className={buttonVariants({ variant: "surface", className: "w-full pad:w-auto" })}
              >
                打开这本
              </Link>
              {wrongs ? (
                <Link to="/wrongs" className={buttonVariants({ variant: "ghost", className: "w-full pad:w-auto" })}>
                  错题 {wrongs}
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-1 text-xl font-semibold">还没有题库</h2>
            <Link to="/banks" className={`${buttonVariants()} mt-4`}>
              去题库
            </Link>
          </>
        )}
        <label className="mt-5 flex items-center gap-2 text-sm text-muted">
          今日目标
          <input
            className="w-20"
            type="number"
            min={5}
            max={200}
            value={lib.dailyGoal}
            suppressHydrationWarning
            onChange={(event) => setDailyGoal(Number(event.target.value))}
          />
        </label>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("清空这台浏览器里的全部题库和记录？")) clearAll();
          }}
        >
          清空
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => resetDemo()}>
          恢复示例
        </Button>
      </div>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li className="aero-float px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </li>
  );
}
