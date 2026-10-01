"use client";

import { t } from "@/lib/i18n/translate";
// Message discret : chargement en cours ou liste vide.
// « page » : seul contenu de la page ; « list » : à la place des lignes d'une liste.

export function MutedMessage({
  variant = "page",
  className = "",
  children = t("Chargement…"),
}: {
  variant?: "page" | "list";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <p className={`text-center text-sm text-ink-5 ${variant === "list" ? "px-5 py-8" : ""} ${className}`.trim()}>{children}</p>
  );
}
