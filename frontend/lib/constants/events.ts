// Catégories d'événements : libellés, filtres et styles d'affichage.

export type EventCategory =
  | "Concert"
  | "Festival"
  | "Théâtre"
  | "Sport"
  | "Conférence"
  | "Danse"
  | "Autre";

// Bug corrigé (demande produit, 2 passes) : bandeau événement décliné en 7
// couleurs vives distinctes par catégorie, d'abord uniformisé en un
// dégradé gris ardoise, puis passé en teinte unie (plus de dégradé du
// tout — cf. les consommateurs de `band`, qui n'ajoutent plus
// bg-gradient-to-br devant cette classe).
export const apiCategoryMeta: Record<
  string,
  { label: EventCategory; emoji: string; band: string }
> = {
  CONCERT: { label: "Concert", emoji: "🎧", band: "bg-slate-800" },
  THEATRE: { label: "Théâtre", emoji: "🎭", band: "bg-slate-800" },
  DANSE: { label: "Danse", emoji: "💃", band: "bg-slate-800" },
  FESTIVAL: { label: "Festival", emoji: "🎪", band: "bg-slate-800" },
  CONFERENCE: { label: "Conférence", emoji: "💡", band: "bg-slate-800" },
  SPORT: { label: "Sport", emoji: "⚽", band: "bg-slate-800" },
  AUTRE: { label: "Autre", emoji: "✨", band: "bg-slate-800" },
};
