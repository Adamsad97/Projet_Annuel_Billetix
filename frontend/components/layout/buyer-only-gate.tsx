"use client";

// Bug corrigé (règle produit incomplète) : "un compte ADMIN reste purement
// administratif, jamais acheteur" n'était appliqué qu'à la nav et à la
// page Profil (cf. commit 220f98e) — l'accueil, le catalogue et la revente
// restaient accessibles et achetables tels quels pour un admin qui y
// naviguait directement (l'accueil n'est même pas dans le menu ADMIN, mais
// rien n'empêchait d'y atterrir). Redirige vers le back-office plutôt que
// de juste masquer le contenu : ces pages ne servent à rien pour ce rôle.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth/session";

export function BuyerOnlyGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const role = getStoredUser()?.role;
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      router.replace("/admin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
