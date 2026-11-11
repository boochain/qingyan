import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/banks/$bankId")({
  component: BankLayout,
});

function BankLayout() {
  return <Outlet />;
}
