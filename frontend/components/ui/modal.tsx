"use client";

// Socle commun des fenêtres modales : voile, Échap et clic à l'extérieur pour
// fermer, défilement de la page bloqué. Rendue dans <body> : l'en-tête crée son
// propre contexte d'empilement, qui laisserait sinon la navigation passer
// au-dessus de la fenêtre.

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  labelledBy,
  label,
  role = "dialog",
  dismissible = true,
  sheetOnMobile = false,
  className = "bg-black/70 p-6",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** id du titre de la fenêtre. */
  labelledBy?: string;
  /** Nom accessible quand la fenêtre n'a pas de titre visible. */
  label?: string;
  role?: "dialog" | "alertdialog";
  /** false : ni Échap ni clic extérieur (action en cours, choix obligatoire). */
  dismissible?: boolean;
  /** Collée en bas de l'écran sur mobile, centrée à partir de sm. */
  sheetOnMobile?: boolean;
  /** Voile : couleur et marges propres à chaque fenêtre. */
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={label}
      // Seul un clic sur le voile lui-même ferme : le contenu reste cliquable.
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-[100] flex justify-center ${sheetOnMobile ? "items-end sm:items-center" : "items-center"} ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
