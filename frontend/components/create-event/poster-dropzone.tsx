"use client";

import { useRef, useState } from "react";

export function PosterDropzone({
  onFileSelected,
  initialPreviewUrl,
}: {
  onFileSelected: (file: File) => void;
  initialPreviewUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl ?? null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    onFileSelected(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={
        isDragging
          ? "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-blue-500 bg-blue-500/5 py-10 text-center"
          : "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-hairline-2 bg-hairline-1 py-10 text-center transition-colors hover:border-hairline-4"
      }
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) avant upload, next/image ne le gère pas
        <img src={previewUrl} alt="Aperçu de l'affiche" className="mb-2 max-h-32 rounded-lg object-contain" />
      ) : (
        <span className="text-2xl">🖼️</span>
      )}
      {fileName ? (
        <span className="text-sm font-medium text-accent">{fileName}</span>
      ) : (
        <span className="text-sm text-ink-5">
          Glissez votre affiche ou cliquez — JPG/PNG max 5 Mo
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}
