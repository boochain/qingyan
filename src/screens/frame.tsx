import { useEffect, useState, type ReactNode } from "react";
import { useQingyan } from "@/lib/qingyan/store";

export function useLibraryReady() {
  const [ready, setReady] = useState(() => useQingyan.persist.hasHydrated());
  useEffect(() => {
    if (useQingyan.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useQingyan.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}

export function Screen({
  title,
  lede,
  actions,
  wide = false,
  children,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "mx-auto flex w-full max-w-6xl flex-col gap-5" : "mx-auto flex w-full max-w-4xl flex-col gap-5"}>
      <header className="flex flex-col gap-3 pad:flex-row pad:items-end pad:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {lede ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{lede}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
