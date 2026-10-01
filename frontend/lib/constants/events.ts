import { msg } from "@/lib/i18n/translate";
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
  CONCERT: { label: msg("Concert"), emoji: "🎧", band: "bg-slate-800" },
  THEATRE: { label: msg("Théâtre"), emoji: "🎭", band: "bg-slate-800" },
  DANSE: { label: msg("Danse"), emoji: "💃", band: "bg-slate-800" },
  FESTIVAL: { label: msg("Festival"), emoji: "🎪", band: "bg-slate-800" },
  CONFERENCE: { label: msg("Conférence"), emoji: "💡", band: "bg-slate-800" },
  SPORT: { label: msg("Sport"), emoji: "⚽", band: "bg-slate-800" },
  AUTRE: { label: msg("Autre"), emoji: "✨", band: "bg-slate-800" },
};
