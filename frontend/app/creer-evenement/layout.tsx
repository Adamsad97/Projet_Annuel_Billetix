import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Création d'événement : organisateur uniquement (vérifié aussi par l'API).
export default function CreateEventLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["ORGANIZER"]}>{children}</RequireAuth>;
}
