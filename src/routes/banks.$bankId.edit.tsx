import { createFileRoute } from "@tanstack/react-router";
import { EditorScreen } from "@/screens/editor";

export const Route = createFileRoute("/banks/$bankId/edit")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: EditRoute,
});

function EditRoute() {
  const { bankId } = Route.useParams();
  const { q } = Route.useSearch();
  return <EditorScreen bankId={bankId} q={q} />;
}
