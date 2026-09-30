"use client";

import { useRef, useState } from "react";

const ACCEPTED = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_SIZE = 10 * 1024 * 1024; // aligné sur la passerelle (POST /upload/document)

/**
 * Zone de dépôt d'une pièce justificative (PDF ou image, 10 Mo max). Le
 * format réel est de toute façon revérifié par la passerelle.
 */
export function DocumentDropzone({
  onFileSelected,
  hint,
  disabled = false,
}: {
  onFileSelected: (file: File | null) => void;
  hint: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!ACCEPTED.split(",").includes(file.type)) {
      setError("Format non supporté — PDF, JPEG, PNG ou WebP uniquement.");
      onFileSelected(null);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Fichier trop volumineux — 10 Mo maximum.");
      onFileSelected(null);
      return;
    }
    setError(null);
    setFileName(file.name);
    onFileSelected(file);
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
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-8 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isDragging ? "border-blue-500 bg-blue-500/5" : "border-hairline-2 bg-hairline-1 hover:border-hairline-4"
        }`}
      >
        <span className="text-2xl">{fileName ? "📄" : "🪪"}</span>
        {fileName ? (
          <span className="text-sm font-medium text-accent">{fileName}</span>
        ) : (
          <span className="px-4 text-sm text-ink-5">{hint}</span>
        )}
        <span className="text-xs text-ink-6">PDF, JPEG, PNG ou WebP — 10 Mo max</span>
      </button>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
