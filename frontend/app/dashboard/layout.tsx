import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Espace organisateur.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["ORGANIZER"]}>{children}</RequireAuth>;
}
