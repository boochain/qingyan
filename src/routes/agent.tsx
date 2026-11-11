import { createFileRoute } from "@tanstack/react-router";
import { AgentScreen } from "@/screens/agent";

export const Route = createFileRoute("/agent")({ component: AgentScreen });
