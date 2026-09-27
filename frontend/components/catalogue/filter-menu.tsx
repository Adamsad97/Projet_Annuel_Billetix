"use client";

// Bouton de filtre à menu déroulant (Catégorie, Date, Prix…) : affiche la
// valeur choisie, se ferme au clic extérieur ou avec Échap.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function FilterMenu({
  label,
  value,
  active,
  children,
  align = "left",
}: {
  label: string;
  /** Valeur affichée dans le bouton quand le filtre est actif. */
  value?: string;
  active: boolean;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
          active
            ? "border-blue-600 bg-blue-600/10 text-ink-1"
            : "border-hairline-3 bg-card text-ink-2 hover:border-hairline-5 hover:text-ink-1"
        }`}
      >
        <span>{active && value ? value : label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`text-ink-5 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          className={`absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-2xl border border-hairline-2 bg-card p-2 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

/** Ligne de choix unique dans un menu de filtre. */
export function FilterOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
        selected ? "bg-hairline-1 font-semibold text-ink-1" : "text-ink-3 hover:bg-hairline-1 hover:text-ink-1"
      }`}
    >
      <span>{children}</span>
      {selected ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-blue-500">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : null}
    </button>
  );
}
