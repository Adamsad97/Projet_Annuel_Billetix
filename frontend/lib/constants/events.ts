// Catégories d'événements : libellés, filtres et styles d'affichage.

export type EventCategory =
  | "Concert"
  | "Festival"
  | "Théâtre"
  | "Sport"
  | "Conférence"
  | "Danse"
  | "Autre";

// Bandeau d'événement en teinte unie par catégorie.
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
