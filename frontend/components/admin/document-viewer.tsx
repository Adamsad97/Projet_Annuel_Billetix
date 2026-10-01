"use client";

import { useEffect, useState } from "react";
import { apiFetchBlob } from "@/lib/api/client";
import { buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export interface SubmittedDocument {
  id: string;
  label: string;
  url: string;
}

function isPdf(url: string): boolean {
  return url.toLowerCase().split("?")[0].endsWith(".pdf");
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PRIVATE_DOCUMENT = new RegExp(`/(${UUID})/(${UUID}\\.(?:pdf|png|jpg|webp))$`, "i");

/** Pièce privée lue via la route authentifiée de la passerelle ; null pour un fichier public (lien direct). */
function privateDocumentPath(url: string): string | null {
  const match = PRIVATE_DOCUMENT.exec(url.split("?")[0]);
  return match ? `/upload/documents/${match[1]}/${match[2]}` : null;
}

/** Adresse affichable : lien direct, ou copie locale d'un document privé. */
function useDocumentSource(url: string): { src: string | null; error: string | null } {
  const path = privateDocumentPath(url);
  const [loaded, setLoaded] = useState<{ path: string; src: string | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!path) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    apiFetchBlob(path)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setLoaded({ path, src: objectUrl, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ path, src: null, error: err.message });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!path) return { src: url, error: null };
  if (loaded?.path !== path) return { src: null, error: null };
  return { src: loaded.src, error: loaded.error };
}

function DocumentThumb({ doc, src, large = false }: { doc: SubmittedDocument; src: string | null; large?: boolean }) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-hairline-2 text-xs text-ink-3 ${
          large ? "aspect-[3/4] w-full max-w-sm rounded-2xl" : "h-40 w-full rounded-xl"
        }`}
      >
        Chargement…
      </div>
    );
  }

  if (isPdf(doc.url)) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gray-800 ${
          large ? "aspect-[3/4] w-full max-w-sm rounded-2xl" : "h-40 w-full rounded-xl"
        }`}
      >
        {/* Texte de couleur fixe : le fond de l'icône PDF est toujours sombre. */}
        <span className={large ? "text-6xl opacity-90" : "text-3xl opacity-90"}>📄</span>
        <span className="text-xs text-gray-400">Document PDF</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fichier hébergé sur MinIO, hors domaines gérés par next/image
    <img
      src={src}
      alt={doc.label}
      className={
        large
          ? "aspect-[3/4] w-full max-w-sm rounded-2xl object-cover"
          : "h-40 w-full rounded-xl object-cover"
      }
    />
  );
}

function DocumentCard({ doc, onEnlarge }: { doc: SubmittedDocument; onEnlarge: (src: string) => void }) {
  const { src, error } = useDocumentSource(doc.url);

  return (
    <button
      type="button"
      disabled={!src}
      onClick={() => {
        if (!src) return;
        if (isPdf(doc.url)) window.open(src, "_blank", "noopener");
        else onEnlarge(src);
      }}
      className="group flex flex-col gap-2 rounded-xl border border-hairline-2 bg-hairline-1 p-3 text-left transition-colors hover:border-hairline-4 disabled:cursor-default"
    >
      {error ? (
        <div className="flex h-40 w-full items-center justify-center rounded-xl bg-hairline-2 p-4 text-center text-xs text-danger">
          {error}
        </div>
      ) : (
        <DocumentThumb doc={doc} src={src} />
      )}
      <div>
        <p className="text-sm font-medium text-ink-1">{doc.label}</p>
      </div>
      {src ? (
        <span className="text-xs font-medium text-link group-hover:text-link-hover">
          {isPdf(doc.url) ? "📥 Ouvrir le PDF" : "🔍 Voir en grand"}
        </span>
      ) : null}
    </button>
  );
}

export function DocumentGrid({ documents }: { documents: SubmittedDocument[] }) {
  const [open, setOpen] = useState<{ doc: SubmittedDocument; src: string } | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} onEnlarge={(src) => setOpen({ doc, src })} />
        ))}
      </div>

      {open ? (
        <Modal open onClose={() => setOpen(null)} label={open.doc.label} className="cursor-pointer bg-black/80 p-6">
          <div
            className="flex w-full max-w-md cursor-auto flex-col items-center gap-4 rounded-2xl border border-hairline-2 bg-card p-6"
          >
            <DocumentThumb doc={open.doc} src={open.src} large />
            <p className="text-center font-medium text-ink-1">{open.doc.label}</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm")}
            >
              Fermer
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
