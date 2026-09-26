import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";

// Tunnel de commande : tout compte connecté.
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
