import { createFileRoute } from "@tanstack/react-router";
import type { PracticeMode } from "@/lib/qingyan/types";
import { PracticeScreen } from "@/screens/practice";

const MODES = ["order", "random", "chapter", "wrong", "recite", "favorite"] as const;

export const Route = createFileRoute("/practice/$bankId")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (MODES.includes(search.mode as (typeof MODES)[number]) ? search.mode : "order") as PracticeMode,
    chapter: typeof search.chapter === "string" ? search.chapter : "",
  }),
  component: PracticeRoute,
});

function PracticeRoute() {
  const { bankId } = Route.useParams();
  const { mode, chapter } = Route.useSearch();
  return <PracticeScreen bankId={bankId} mode={mode} chapter={chapter} />;
}
