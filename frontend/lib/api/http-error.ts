// Erreur HTTP typée ; extractErrorMessage gère message texte (métier) ou tableau (validation).

export class ApiError extends Error {
  status: number;
  // Code métier renvoyé par l'API (ex. "REAUTH_REQUIRED"), s'il y en a un.
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function extractErrorCode(body: unknown): string | undefined {
  if (body && typeof body === "object" && "code" in body) {
    const code = (body as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const msg = (body as { message?: unknown }).message;
    if (Array.isArray(msg)) return msg.join(" · ");
    if (typeof msg === "string") return msg;
  }
  return fallback;
}
