import { createFileRoute } from "@tanstack/react-router";
import { WrongsScreen } from "@/screens/wrongs";

export const Route = createFileRoute("/wrongs")({ component: WrongsScreen });
