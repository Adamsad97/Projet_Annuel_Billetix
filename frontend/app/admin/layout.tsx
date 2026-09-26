import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Back-office : comptes administrateurs uniquement.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={["ADMIN", "SUPER_ADMIN"]}>{children}</RequireAuth>;
}
