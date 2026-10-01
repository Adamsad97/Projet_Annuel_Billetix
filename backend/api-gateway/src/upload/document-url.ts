import { BadRequestException } from "@nestjs/common";

const OWN_DOCUMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$/;

/** Un justificatif doit être un fichier déposé par l'organisateur lui-même. */
export function assertOwnDocumentUrl(url: string, ownerId: string, bucket: string): void {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    throw new BadRequestException("Justificatif invalide.");
  }
  const [, urlBucket, urlOwner, file, ...rest] = path.split("/");
  if (urlBucket !== bucket || urlOwner !== ownerId || !file || rest.length > 0 || !OWN_DOCUMENT.test(file)) {
    throw new BadRequestException("Justificatif invalide : déposez-le depuis votre espace organisateur.");
  }
}
