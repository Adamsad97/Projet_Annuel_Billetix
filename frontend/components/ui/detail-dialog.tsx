"use client";

// Fenêtre de consultation d'une fiche (ex. transfert, revente) : les listes
// n'affichent qu'un résumé, le détail (comptes, noms, contexte) n'est
// montré qu'à la demande. Même habillage qu'ActionDialog ; Échap ou un clic
// à l'extérieur ferme la fenêtre.

import { useEffect, useId, type ReactNode } from "react";

export function DetailDialog({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-lg cursor-auto flex-col rounded-2xl border border-hairline-2 bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline-1 px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-ink-1">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-sm text-ink-5">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full px-2 text-xl leading-none text-ink-5 transition-colors hover:text-ink-1"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-hairline-1 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Bloc titré d'une fiche de détail. */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-hairline-1 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-5">{title}</h3>
      <div className="text-sm text-ink-2">{children}</div>
    </section>
  );
}
