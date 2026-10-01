"use client";

// Fenêtre de consultation d'une fiche ; Échap ou clic à l'extérieur pour fermer.

import { useId, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { t } from "@/lib/i18n/translate";

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

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="cursor-pointer bg-black/70 p-4 sm:p-6">
      <div
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
            aria-label={t("Fermer")}
            className="rounded-full px-2 text-xl leading-none text-ink-5 transition-colors hover:text-ink-1"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-hairline-1 px-6 py-4">{footer}</div> : null}
      </div>
    </Modal>
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
