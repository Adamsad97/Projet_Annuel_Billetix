// Côté serveur, API_INTERNAL_URL (nom de service Docker) ; dans le navigateur, NEXT_PUBLIC_API_URL.
export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return (
      process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:4000/api/v1"
    );
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
}
