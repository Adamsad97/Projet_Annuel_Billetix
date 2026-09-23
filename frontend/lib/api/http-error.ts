// Erreur HTTP typée pour les appels à l'api-gateway. Le format des erreurs
// varie selon leur origine :
// - RpcException (métier, ex: "Email déjà utilisé") -> { statusCode, message: string }
// - ValidationPipe (DTO invalide) -> { statusCode, message: string[], error }
// extractErrorMessage gère les deux formes.

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const msg = (body as { message?: unknown }).message;
    if (Array.isArray(msg)) return msg.join(" · ");
    if (typeof msg === "string") return msg;
  }
  return fallback;
}
