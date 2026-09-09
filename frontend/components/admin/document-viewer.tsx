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
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 ${
          large ? "aspect-[3/4] w-full max-w-sm rounded-2xl" : "h-40 w-full rounded-xl"
        }`}
      >
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
            className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-white/20"
          >
            <DocumentThumb doc={doc} />
            <div>
              <p className="text-sm font-medium text-white">{doc.label}</p>
            </div>
            <span className="text-xs font-medium text-violet-400 group-hover:text-violet-300">
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
            className="flex w-full max-w-md cursor-auto flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#12101c] p-6"
          >
            <DocumentThumb doc={open} large />
            <p className="text-center font-medium text-white">{open.label}</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
