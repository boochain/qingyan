import { createFileRoute } from "@tanstack/react-router";
import { StatsScreen } from "@/screens/stats";

export const Route = createFileRoute("/stats")({ component: StatsScreen });
