import { createFileRoute } from "@tanstack/react-router";
import { LibraryScreen } from "@/screens/library";

export const Route = createFileRoute("/banks/")({ component: LibraryScreen });
