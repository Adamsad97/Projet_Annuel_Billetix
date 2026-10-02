/** Client HTTP des tests fonctionnels : la pile complète est appelée comme le ferait le site, via la passerelle. */
export const API_URL = (process.env.E2E_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

interface RequestOptions {
  token?: string;
  body?: unknown;
  form?: FormData;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Une limite de débit atteinte (429) n'est pas un échec du test : on attend le délai annoncé (Retry-After) puis on rejoue. */
export async function api<T = any>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  for (let attempt = 0; ; attempt++) {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    let payload: BodyInit | undefined;
    if (options.form) payload = options.form;
    else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(((retryAfter > 0 ? retryAfter : 60) + 1) * 1000);
      continue;
    }
    const text = await response.text();
    let body: any = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Réponse non JSON (PDF, texte) : renvoyée telle quelle.
    }
    return { status: response.status, body };
  }
}

export const get = <T = any>(path: string, token?: string) => api<T>("GET", path, { token });
export const post = <T = any>(path: string, body?: unknown, token?: string) =>
  api<T>("POST", path, { body: body ?? {}, token });
export const patch = <T = any>(path: string, body: unknown, token?: string) => api<T>("PATCH", path, { body, token });
export const del = <T = any>(path: string, body?: unknown, token?: string) => api<T>("DELETE", path, { body, token });

/** Message d'erreur lisible, que la validation renvoie une chaîne ou une liste. */
export function errorMessage(response: ApiResponse): string {
  const message = response.body?.message;
  return Array.isArray(message) ? message.join(" ") : String(message ?? "");
}
