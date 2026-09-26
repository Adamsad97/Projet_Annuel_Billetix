"use client";

import { useState } from "react";

export interface SubmittedDocument {
  id: string;
  label: string;
  url: string;
}

function isPdf(url: string): boolean {
  return url.toLowerCase().split("?")[0].endsWith(".pdf");
}

function DocumentThumb({ doc, large = false }: { doc: SubmittedDocument; large?: boolean }) {
  if (isPdf(doc.url)) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gray-800 ${
          large ? "aspect-[3/4] w-full max-w-sm rounded-2xl" : "h-40 w-full rounded-xl"
        }`}
      >
        {/* Bug corrigé : fond gris foncé fixe (icône PDF), jamais lié au
            thème — texte épinglé plutôt que sur un token ink-* (sombre en
            mode clair, invisible sur ce fond toujours sombre). */}
        <span className={large ? "text-6xl opacity-90" : "text-3xl opacity-90"}>📄</span>
        <span className="text-xs text-gray-400">Document PDF</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fichier hébergé sur MinIO, hors domaines gérés par next/image
    <img
      src={doc.url}
      alt={doc.label}
      className={
        large
          ? "aspect-[3/4] w-full max-w-sm rounded-2xl object-cover"
          : "h-40 w-full rounded-xl object-cover"
      }
    />
  );
}

export function DocumentGrid({ documents }: { documents: SubmittedDocument[] }) {
  const [open, setOpen] = useState<SubmittedDocument | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {documents.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => (isPdf(doc.url) ? window.open(doc.url, "_blank") : setOpen(doc))}
            className="group flex flex-col gap-2 rounded-xl border border-hairline-2 bg-hairline-1 p-3 text-left transition-colors hover:border-hairline-4"
          >
            <DocumentThumb doc={doc} />
            <div>
              <p className="text-sm font-medium text-ink-1">{doc.label}</p>
            </div>
            <span className="text-xs font-medium text-link group-hover:text-link-hover">
              {isPdf(doc.url) ? "📥 Ouvrir le PDF" : "🔍 Voir en grand"}
            </span>
          </button>
        ))}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/80 p-6"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-md cursor-auto flex-col items-center gap-4 rounded-2xl border border-hairline-2 bg-card p-6"
          >
            <DocumentThumb doc={open} large />
            <p className="text-center font-medium text-ink-1">{open.label}</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
