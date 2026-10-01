"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

/** Affiche présentée sans recadrage ; un clic l'ouvre en plein écran. */
export function PosterViewer({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Agrandir l'affiche : ${title}`}
        className="group relative inline-block max-w-full overflow-hidden rounded-2xl align-top shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/15 transition-transform duration-500 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO, hors domaines gérés par next/image */}
        <img
          src={src}
          alt={`Affiche : ${title}`}
          className="block h-auto max-h-[560px] w-auto max-w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        {/* Reflet discret en haut de l'affiche, comme un tirage glacé. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent"
        />
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          Agrandir
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        label={`Affiche : ${title}`}
        className="cursor-zoom-out bg-black/90 p-4 backdrop-blur-sm sm:p-10"
      >
          {/* eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO */}
          <img
            onClick={() => setOpen(false)}
            src={src}
            alt={`Affiche : ${title}`}
            className="max-h-[calc(100dvh-2rem)] max-w-full rounded-xl object-contain shadow-2xl sm:max-h-[calc(100dvh-5rem)]"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
      </Modal>
    </>
  );
}
