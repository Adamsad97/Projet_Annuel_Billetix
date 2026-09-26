// Catégories d'événements : libellés, filtres et styles d'affichage.

export type EventCategory =
  | "Concert"
  | "Festival"
  | "Théâtre"
  | "Sport"
  | "Conférence"
  | "Danse"
  | "Autre";

export interface MockEvent {
  id: string;
  day: string;
  month: string;
  title: string;
  subtitle?: string;
  city: string;
  emoji: string;
  band: string; // classes Tailwind du bandeau (dégradé)
  badge?: string;
  category: EventCategory;
  priceLabel: string;
  free?: boolean;
}

// icon "location" : icône SVG partagée (LocationPinIcon) plutôt qu'un emoji.
export const categoryFilters: { label: string; emoji?: string; icon?: "location" }[] = [
  { label: "Tous" },
  { label: "Concert", emoji: "🎵" },
  { label: "Festival", emoji: "🎪" },
  { label: "Théâtre", emoji: "🎭" },
  { label: "Sport", emoji: "⚽" },
  { label: "Conférence", emoji: "💡" },
  { label: "Gratuit", emoji: "🎫" },
  { label: "Près de moi", icon: "location" },
];

// Bug corrigé (demande produit) : "Concert" et "Danse" utilisaient du
// violet/fuchsia — retiré de toute la palette (texte, boutons, bandeaux).
// Recoloré en bleu (cohérent avec la nouvelle couleur de marque) et cyan
// pour rester distincts l'un de l'autre.
export const categoryPillStyles: Record<EventCategory, string> = {
  Concert: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  Théâtre: "bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30",
  Festival: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  Sport: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  Conférence: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30",
  Danse: "bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-500/30",
  Autre: "bg-gray-500/15 text-ink-3 ring-1 ring-inset ring-gray-500/30",
};

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
