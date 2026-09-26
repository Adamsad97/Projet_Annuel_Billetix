import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Revente : réservée aux acheteurs connectés (l'API refuse aussi la lecture
// anonyme des annonces).
export default function ResaleLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["BUYER"]}>{children}</RequireAuth>;
}
