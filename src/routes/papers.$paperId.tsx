import { createFileRoute } from "@tanstack/react-router";
import { ExamScreen } from "@/screens/exam";

export const Route = createFileRoute("/papers/$paperId")({ component: ExamRoute });

function ExamRoute() {
  const { paperId } = Route.useParams();
  return <ExamScreen paperId={paperId} />;
}
