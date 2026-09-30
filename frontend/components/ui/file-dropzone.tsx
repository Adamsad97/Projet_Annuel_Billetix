"use client";

// Zone de dépôt d'un fichier : clic ou glisser-déposer, contrôle du format et
// de la taille avant envoi (revérifiés de toute façon par la passerelle).
// Le contenu affiché dans la zone est fourni par l'appelant.

import { useRef, useState, type ReactNode } from "react";

export function FileDropzone({
  accept,
  maxBytes,
  formatsLabel,
  onFileSelected,
  disabled = false,
  className = "py-8",
  children,
}: {
  /** Types MIME acceptés. */
  accept: readonly string[];
  maxBytes: number;
  /** Formats lisibles pour le message d'erreur, ex. « PDF, JPEG, PNG ou WebP ». */
  formatsLabel: string;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
  /** Contenu de la zone, selon le fichier retenu. */
  children: (file: File | null) => ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (!accept.includes(picked.type)) {
      setError(`Format non supporté — ${formatsLabel} uniquement.`);
      onFileSelected(null);
      return;
    }
    if (picked.size > maxBytes) {
      setError(`Fichier trop volumineux — ${Math.round(maxBytes / (1024 * 1024))} Mo maximum.`);
      onFileSelected(null);
      return;
    }
    setError(null);
    setFile(picked);
    onFileSelected(picked);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) handleFiles(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className} ${
          isDragging ? "border-blue-500 bg-blue-500/5" : "border-hairline-2 bg-hairline-1 hover:border-hairline-4"
        }`}
      >
        {children(file)}
      </button>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
