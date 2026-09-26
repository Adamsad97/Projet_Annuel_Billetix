"use client";

// Liens d'email vers une page sensible (billets, commande) : /connexion
// ?reauth=1 — demande produit : l'authentification est exigée à CHAQUE clic,
// même si une session est déjà ouverte dans ce navigateur (appareil partagé,
// email transféré…). On ferme donc la session existante (révoquée côté
// serveur), puis on recharge la page pour repartir d'un état propre.

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
