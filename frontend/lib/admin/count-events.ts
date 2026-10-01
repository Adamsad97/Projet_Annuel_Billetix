// Signal « un compteur du menu admin a changé » : les pastilles se rechargent sans recharger la page.

const EVENT_NAME = "billetix:admin-counts-changed";

export function notifyAdminCountsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT_NAME));
}

/** Abonnement au signal ; renvoie la fonction de désabonnement. */
export function onAdminCountsChanged(listener: () => void): () => void {
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

/** Exécute l'appel puis signale le changement en cas de succès. */
export async function withCountsRefresh<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  notifyAdminCountsChanged();
  return result;
}
