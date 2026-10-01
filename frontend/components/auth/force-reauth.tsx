"use client";

// Lien d'email vers une page sensible : ferme la session existante pour exiger une connexion à chaque clic.

import { useEffect } from "react";
import { logout } from "@/lib/auth/logout";
import { getAccessToken } from "@/lib/auth/session";

export function ForceReauth() {
  useEffect(() => {
    if (!getAccessToken()) return;
    void logout("manuelle").then(() => window.location.replace(window.location.href));
  }, []);
  return null;
}
