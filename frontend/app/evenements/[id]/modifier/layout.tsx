import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Modification d'événement : organisateur uniquement (propriété vérifiée par l'API).
export default function EditEventLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["ORGANIZER"]}>{children}</RequireAuth>;
}
