import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/papers")({
  component: PapersLayout,
});

function PapersLayout() {
  return <Outlet />;
}
