/**
 * Type réel d'un fichier, lu dans ses premiers octets (signature), et non
 * dans le type annoncé par le navigateur, que l'utilisateur contrôle : un
 * fichier HTML renommé en « photo.png » est ainsi refusé.
 */
export type DetectedType = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";

export const EXTENSIONS: Record<DetectedType, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export function detectFileType(buffer: Buffer): DetectedType | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
