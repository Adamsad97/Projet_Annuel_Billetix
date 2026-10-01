"use client";

// Pages réservées protégées côté interface ; la vraie protection reste l'API.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { UserRole } from "@/lib/api/auth";
import { getAccessToken, getStoredUser, SESSION_ENDED_EVENT } from "@/lib/auth/session";
import { effectiveRole, isAdminRole, PREVIEW_CHANGED_EVENT } from "@/lib/auth/preview";
import { t } from "@/lib/i18n/translate";

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
      // Mode aperçu : les pages d'un rôle s'ouvrent pour l'admin qui le
      // prévisualise ; le back-office reste jugé sur le vrai rôle.
      const role = roles?.some(isAdminRole) ? user.role : (effectiveRole(user) ?? user.role);
      if (roles && !roles.includes(role)) {
        setAllowed(false);
        router.replace(homePathForRole(role));
        return;
      }
      setAllowed(true);
    }
    check();
    // Fin de session pendant qu'on est sur la page : on masque aussitôt le
    // contenu (SessionManager se charge de la redirection avec le motif).
    const onEnded = () => setAllowed(false);
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    window.addEventListener(PREVIEW_CHANGED_EVENT, check);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
      window.removeEventListener(PREVIEW_CHANGED_EVENT, check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!allowed) {
    return (
      <div className="flex flex-1 items-center justify-center bg-page py-24">
        <p className="text-sm text-ink-5">{t("Vérification de l'accès…")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
