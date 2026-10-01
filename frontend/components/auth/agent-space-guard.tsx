"use client";

// Un agent ne sert qu'au contrôle : toute page d'achat le renvoie vers le scan.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getStoredUser, SESSION_ENDED_EVENT } from "@/lib/auth/session";

/** Pages ouvertes à un agent : contrôle, son compte, informations légales et aide. */
const AGENT_PAGES = [
  "/scan",
  "/profil",
  "/profil/securite",
  "/auth",
  "/connexion",
  "/mot-de-passe-oublie",
  "/aide",
  "/contact",
  "/cgu",
  "/confidentialite",
  "/mentions-legales",
];

export function isAgentPage(pathname: string): boolean {
  return AGENT_PAGES.some((page) => pathname === page || (page !== "/profil" && pathname.startsWith(`${page}/`)));
}

export function AgentSpaceGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const check = () => {
      // Redirection complète : une page qui réécrit son adresse (filtres du
      // catalogue) ne peut pas l'annuler.
      if (getStoredUser()?.role === "AGENT" && !isAgentPage(window.location.pathname)) window.location.replace("/scan");
    };
    check();
    window.addEventListener(SESSION_ENDED_EVENT, check);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, check);
  }, [pathname]);

  return null;
}
