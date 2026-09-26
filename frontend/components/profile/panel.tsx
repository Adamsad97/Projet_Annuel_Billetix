"use client";

// Replié par défaut — l'utilisateur clique pour dérouler le contenu plutôt
// que de voir billets/commandes s'afficher directement à l'arrivée sur /profil.

import { useState, type ReactNode } from "react";

export function Panel({
  icon,
  title,
  action,
  children,
  defaultExpanded = false,
}: {
  icon: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between border-b border-hairline-1 px-5 py-4 text-left transition-colors hover:bg-hairline-1"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          <span>{icon}</span>
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {action ? (
            // Empêche le clic sur l'action (ex. "Tout voir →") de replier le
            // panneau en même temps qu'il navigue.
            <span onClick={(event) => event.stopPropagation()}>{action}</span>
          ) : null}
          <span
            className={`text-ink-5 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
      </button>
      {expanded ? <div>{children}</div> : null}
    </div>
  );
}
