"use client";

import { FileDropzone } from "@/components/ui/file-dropzone";
import { t } from "@/lib/i18n/translate";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // aligné sur la passerelle (POST /upload/document)

/** Zone de dépôt d'une pièce justificative (PDF ou image, 10 Mo max). */
export function DocumentDropzone({
  onFileSelected,
  hint,
  disabled = false,
}: {
  onFileSelected: (file: File | null) => void;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <FileDropzone
      accept={ACCEPTED}
      maxBytes={MAX_SIZE}
      formatsLabel={t("PDF, JPEG, PNG ou WebP")}
      onFileSelected={onFileSelected}
      disabled={disabled}
    >
      {(file) => (
        <>
          <span className="text-2xl">{file ? "📄" : "🪪"}</span>
          {file ? (
            <span className="text-sm font-medium text-accent">{file.name}</span>
          ) : (
            <span className="px-4 text-sm text-ink-5">{hint}</span>
          )}
          <span className="text-xs text-ink-6">{t("PDF, JPEG, PNG ou WebP — 10 Mo max")}</span>
        </>
      )}
    </FileDropzone>
  );
}
