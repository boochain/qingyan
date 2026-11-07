import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, BookOpen, Bot, FileText, Layers, RotateCcw } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useQingyan } from "@/lib/qingyan/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "书桌", icon: BookOpen },
  { to: "/banks", label: "题库", icon: Layers },
  { to: "/wrongs", label: "错题", icon: RotateCcw },
  { to: "/papers", label: "试卷", icon: FileText },
  { to: "/stats", label: "统计", icon: BarChart3 },
  { to: "/agent", label: "Agent", icon: Bot },
] as const;

function active(path: string, to: string) {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    void useQingyan.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <Seal />
          <div>
            <p className="font-display text-xl leading-none">青砚</p>
            <p className="mt-1 text-xs text-muted">自托管刷题室</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} on={active(path, item.to)} />
          ))}
        </nav>
        <p className="px-5 py-5 text-xs leading-5 text-muted">题目留在这台浏览器。换机器，用导入导出。</p>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur md:hidden">
          <Seal />
          <p className="font-display text-lg">青砚</p>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-12">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-surface md:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = active(path, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs",
                  on ? "text-primary" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  on,
}: {
  to: (typeof NAV)[number]["to"];
  label: string;
  icon: (typeof NAV)[number]["icon"];
  on: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
        on ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

function Seal() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-md border border-primary bg-primary/15 font-display text-lg text-primary">
      青
    </span>
  );
}
