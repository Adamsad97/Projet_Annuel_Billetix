// Bug corrigé : toutes les requêtes (client ET Server Components) visaient
// NEXT_PUBLIC_API_URL (http://localhost:4000/...), correct uniquement
// depuis le navigateur (sur l'hôte, où Docker publie le port 4000).
// Exécuté côté serveur (Server Component, à l'intérieur du conteneur
// frontend), "localhost" désigne le conteneur frontend lui-même — pas
// l'api-gateway — donc chaque fetch échouait silencieusement (`.catch(()
// => [])` un peu partout) et les pages "async function Page()" rendaient
// des listes vides sans la moindre erreur visible. Symptôme observé : une
// catégorie d'événement fraîchement créée invisible sur /creer-evenement,
// mais bien présente via l'API — en réalité, TOUTES les pages Server
// Component (accueil, catalogue, détail événement, revente) étaient
// concernées, masqué en pratique par un refetch côté client qui écrase
// discrètement le rendu serveur vide.
//
// API_INTERNAL_URL (sans préfixe NEXT_PUBLIC_, donc jamais exposé au
// bundle navigateur) cible l'api-gateway par son nom de service Docker —
// n'a de sens que côté serveur, d'où le fallback sur NEXT_PUBLIC_API_URL
// si absent (ex: build/test hors Docker).
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
