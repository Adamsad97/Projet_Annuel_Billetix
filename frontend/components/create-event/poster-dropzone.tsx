"use client";

import { useEffect, useState } from "react";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { t } from "@/lib/i18n/translate";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // aligné sur la passerelle (POST /upload/image)

export function PosterDropzone({
  onFileSelected,
  initialPreviewUrl,
}: {
  onFileSelected: (file: File) => void;
  initialPreviewUrl?: string | null;
}) {
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Libère l'aperçu local précédent quand un autre fichier est choisi.
  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const previewUrl = localPreview ?? initialPreviewUrl ?? null;

  return (
    <FileDropzone
      accept={ACCEPTED}
      maxBytes={MAX_SIZE}
      formatsLabel={t("JPEG, PNG ou WebP")}
      className="py-10"
      onFileSelected={(file) => {
        if (!file) return;
        setLocalPreview(URL.createObjectURL(file));
        onFileSelected(file);
      }}
    >
      {(file) => (
        <>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) avant upload, next/image ne le gère pas
            <img src={previewUrl} alt={t("Aperçu de l'affiche")} className="mb-2 max-h-32 rounded-lg object-contain" />
          ) : (
            <span className="text-2xl">🖼️</span>
          )}
          {file ? (
            <span className="text-sm font-medium text-accent">{file.name}</span>
          ) : (
            <span className="text-sm text-ink-5">{t("Glissez votre affiche ou cliquez — JPG, PNG ou WebP, 5 Mo max")}</span>
          )}
        </>
      )}
    </FileDropzone>
  );
}
