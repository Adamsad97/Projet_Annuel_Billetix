"use client";

// Bug corrigé (faille d'interface) : aucune page réservée n'était protégée
// côté frontend — le back-office, le tableau de bord organisateur, le
// profil… s'affichaient à un visiteur non connecté, seuls les appels API
// échouant (message « Ta session a expiré » alors qu'il n'y avait jamais eu
// de session). La vraie protection reste l'API (JWT + rôles vérifiés par
// l'api-gateway) : ce garde évite d'afficher une page inutilisable et
// renvoie au bon endroit.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { UserRole } from "@/lib/api/auth";
import { getAccessToken, getStoredUser, SESSION_ENDED_EVENT } from "@/lib/auth/session";

/** Espace de chaque rôle — destination si on arrive sur une section d'un autre rôle. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      return "/admin";
    case "ORGANIZER":
      return "/dashboard";
    case "AGENT":
      return "/scan";
    default:
      return "/";
  }
}

export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    function check() {
      const user = getStoredUser();
      if (!getAccessToken() || !user) {
        setAllowed(false);
        const next = window.location.pathname + window.location.search;
        router.replace(`/connexion?next=${encodeURIComponent(next)}`);
        return;
      }
      if (roles && !roles.includes(user.role)) {
        setAllowed(false);
        router.replace(homePathForRole(user.role));
        return;
      }
      setAllowed(true);
    }
    check();
    // Fin de session pendant qu'on est sur la page : on masque aussitôt le
    // contenu (SessionManager se charge de la redirection avec le motif).
    const onEnded = () => setAllowed(false);
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!allowed) {
    return (
      <div className="flex flex-1 items-center justify-center bg-page py-24">
        <p className="text-sm text-ink-5">Vérification de l&apos;accès…</p>
      </div>
    );
  }
  return <>{children}</>;
}
