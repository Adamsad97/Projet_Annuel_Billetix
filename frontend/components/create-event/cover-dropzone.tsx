"use client";

import { useEffect, useState } from "react";
import { FileDropzone } from "@/components/ui/file-dropzone";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // aligné sur la passerelle (POST /upload/poster)

/**
 * Image de couverture horizontale (16:9) des cartes d'événement, facultative :
 * sans elle, les cartes montrent l'affiche sur un fond flou. Une image
 * verticale est acceptée mais signalée (elle serait recadrée sur les cartes).
 */
export function CoverDropzone({
  onFileSelected,
  initialPreviewUrl,
  onRemove,
}: {
  onFileSelected: (file: File) => void;
  initialPreviewUrl?: string | null;
  /** Retire la couverture (enregistrée ou choisie). */
  onRemove?: () => void;
}) {
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const previewUrl = localPreview ?? initialPreviewUrl ?? null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-4">
        Image affichée en haut des cartes de votre événement, en pleine largeur. Format paysage 16:9 recommandé
        (par exemple 1920 × 1080 px). Sans couverture, votre affiche est utilisée.
      </p>
      <FileDropzone
        accept={ACCEPTED}
        maxBytes={MAX_SIZE}
        formatsLabel="JPEG, PNG ou WebP"
        className="py-6"
        onFileSelected={(file) => {
          if (!file) return;
          const url = URL.createObjectURL(file);
          setLocalPreview(url);
          const probe = new Image();
          probe.onload = () => setPortrait(probe.naturalHeight > probe.naturalWidth);
          probe.src = url;
          onFileSelected(file);
        }}
      >
        {(file) => (
          <>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) ou MinIO, next/image ne gère pas blob:
              <img
                src={previewUrl}
                alt="Aperçu de la couverture"
                className="mb-2 aspect-video w-full max-w-sm rounded-lg object-cover"
              />
            ) : (
              <span className="text-2xl">🌄</span>
            )}
            {file ? (
              <span className="text-sm font-medium text-accent">{file.name}</span>
            ) : (
              <span className="text-sm text-ink-5">Glissez votre couverture ou cliquez — JPG, PNG ou WebP, 5 Mo max</span>
            )}
          </>
        )}
      </FileDropzone>
      {portrait ? (
        <p role="status" className="text-sm text-warning">
          Cette image est verticale : sur les cartes, elle sera recadrée en format paysage. Choisissez plutôt une
          image horizontale.
        </p>
      ) : null}
      {previewUrl && onRemove ? (
        <button
          type="button"
          onClick={() => {
            setLocalPreview(null);
            setPortrait(false);
            onRemove();
          }}
          className="self-start text-sm font-medium text-danger hover:underline"
        >
          Retirer la couverture
        </button>
      ) : null}
    </div>
  );
}
