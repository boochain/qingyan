import { createFileRoute } from "@tanstack/react-router";
import { BankScreen } from "@/screens/bank";

export const Route = createFileRoute("/banks/$bankId/")({
  component: BankRoute,
});

function BankRoute() {
  const { bankId } = Route.useParams();
  return <BankScreen bankId={bankId} />;
}
