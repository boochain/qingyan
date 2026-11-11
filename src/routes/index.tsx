import { createFileRoute } from "@tanstack/react-router";
import { DeskScreen } from "@/screens/desk";

export const Route = createFileRoute("/")({ component: DeskScreen });
