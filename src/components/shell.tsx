import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, BookOpen, Bot, FileText, Layers, RotateCcw, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useQingyan } from "@/lib/qingyan/store";
import { applyTheme, readTheme, type Theme } from "@/lib/qingyan/theme";
import { cn } from "@/lib/utils";

type Item = { to: "/" | "/banks" | "/wrongs" | "/papers" | "/stats" | "/agent"; label: string; icon: LucideIcon };

const PRACTICE: Item[] = [
  { to: "/", label: "书桌", icon: BookOpen },
  { to: "/wrongs", label: "错题", icon: RotateCcw },
  { to: "/papers", label: "试卷", icon: FileText },
];

const LIBRARY: Item[] = [
  { to: "/banks", label: "题库", icon: Layers },
  { to: "/stats", label: "统计", icon: BarChart3 },
];

const CONNECT: Item[] = [{ to: "/agent", label: "Agent", icon: Bot }];

const ALL: Item[] = [...PRACTICE, ...LIBRARY, ...CONNECT];

const PHONE: Item[] = [PRACTICE[0], LIBRARY[0], PRACTICE[1], PRACTICE[2], LIBRARY[1]];

function active(path: string, to: string) {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    void useQingyan.persist.rehydrate();
  }, []);

  useLayoutEffect(() => {
    const current = readTheme();
    applyTheme(current, false);
    setTheme(current);
    const onTheme = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    window.addEventListener("qingyan-theme", onTheme);
    return () => window.removeEventListener("qingyan-theme", onTheme);
  }, []);

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <div className="relative min-h-dvh text-fg">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <span className="aero-orb left-[6%] top-[14%] size-20" />
        <span className="aero-orb right-[10%] top-[22%] size-12" />
        <span className="aero-orb bottom-[16%] left-[18%] size-28" />
        <span className="aero-orb right-[16%] bottom-[12%] size-10" />
      </div>

      <aside className="aero-float fixed bottom-3 left-3 top-3 z-20 hidden w-60 flex-col p-3 desk:flex">
        <div className="px-2 py-1">
          <p className="text-base font-semibold tracking-tight">青砚</p>
          <p className="text-xs text-muted">晴空题库</p>
        </div>
        <nav className="mt-3 flex flex-1 flex-col gap-4 overflow-y-auto">
          <NavGroup label="做题" items={PRACTICE} path={path} />
          <NavGroup label="资料" items={LIBRARY} path={path} />
          <NavGroup label="接入" items={CONNECT} path={path} />
        </nav>
        <ThemeButton theme={theme} onClick={toggleTheme} />
        <p className="mt-2 px-2 text-xs leading-5 text-muted">题目保存在这台浏览器。</p>
      </aside>

      <aside className="aero-float fixed bottom-3 left-3 top-3 z-20 hidden w-[4.75rem] flex-col items-center px-1.5 py-3 pad:flex desk:hidden">
        <p className="pb-2 text-xs font-semibold">青砚</p>
        <nav className="flex w-full flex-1 flex-col gap-1 overflow-y-auto">
          {ALL.map((item) => (
            <RailLink key={item.to} item={item} on={active(path, item.to)} />
          ))}
        </nav>
        <ThemeButton theme={theme} onClick={toggleTheme} compact />
      </aside>

      <div className="pad:pl-[6.5rem] desk:pl-[16.5rem]">
        <header className="sticky top-0 z-30 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pad:hidden">
          <div className="aero-float flex items-center justify-between px-4 py-2">
            <p className="text-sm font-semibold">青砚</p>
            <div className="flex items-center gap-1">
              <Link to="/agent" className="gloss gloss-glass inline-flex min-h-11 items-center rounded-full px-3 text-sm">
                Agent
              </Link>
              <ThemeButton theme={theme} onClick={toggleTheme} compact />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pad:max-w-5xl pad:px-5 pad:py-5 pad:pb-8 desk:max-w-[78rem] desk:px-8">
          {children}
        </main>
        <nav className="aero-float fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 p-1 pad:hidden">
          {PHONE.map((item) => {
            const Icon = item.icon;
            const on = active(path, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs transition-[scale,background-color] duration-150 active:scale-[0.96]",
                  on ? "gloss gloss-blue" : "text-muted",
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

function NavGroup({ label, items, path }: { label: string; items: Item[]; path: string }) {
  return (
    <div>
      <p className="px-3 pb-1 text-xs text-muted">{label}</p>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink key={item.to} item={item} on={active(path, item.to)} />
        ))}
      </div>
    </div>
  );
}

function ThemeButton({ theme, onClick, compact = false }: { theme: Theme; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("gloss gloss-glass min-h-11 rounded-full text-sm", compact ? "px-3" : "w-full")}
    >
      {theme === "dark" ? "晴空" : "夜空"}
    </button>
  );
}

function NavLink({ item, on }: { item: Item; on: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-full px-3 text-sm transition-[scale,background-color] duration-150 active:scale-[0.96]",
        on ? "gloss gloss-blue" : "text-muted hover:bg-white/40",
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}

function RailLink({ item, on }: { item: Item; on: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl text-[11px] leading-none transition-[scale,background-color] duration-150 active:scale-[0.96]",
        on ? "gloss gloss-blue" : "text-muted",
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}
