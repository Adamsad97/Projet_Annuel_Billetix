import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Profil : tout compte connecté.
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
