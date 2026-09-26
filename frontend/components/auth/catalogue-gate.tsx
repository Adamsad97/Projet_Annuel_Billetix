"use client";

// Le catalogue est l'espace des clients : un admin n'y a pas accès, sauf
// lorsqu'il prévisualise le rôle acheteur (mode aperçu du back-office).

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { getStoredUser } from "@/lib/auth/session";
import { getPreviewRole, isAdminRole } from "@/lib/auth/preview";

export function CatalogueGate({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (isAdminRole(getStoredUser()?.role) && getPreviewRole() !== "BUYER") {
      router.replace("/admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
