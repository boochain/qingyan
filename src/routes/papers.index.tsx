import { createFileRoute } from "@tanstack/react-router";
import { PapersScreen } from "@/screens/papers";

export const Route = createFileRoute("/papers/")({ component: PapersScreen });
