import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Billets : tout compte connecté (propriété vérifiée par l'API).
export default function TicketsLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
