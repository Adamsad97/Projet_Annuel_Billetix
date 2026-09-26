import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Contrôle des billets : organisateur (ses événements) et agent.
export default function ScanLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["ORGANIZER", "AGENT"]}>{children}</RequireAuth>;
}
