// Données de démonstration pour la page d'accueil — aucun appel API,
// à remplacer par le catalogue réel (event-service) lors du câblage.

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

export const featuredEvents: MockEvent[] = [
  {
    id: "nuit-electronique",
    day: "15",
    month: "août",
    title: "Nuit Électronique",
    city: "La Défense, Paris",
    emoji: "🎧",
    band: "from-slate-700 via-slate-800 to-slate-950",
    badge: "1 200 places",
    category: "Concert",
    priceLabel: "À partir de 35 €",
  },
  {
    id: "romeo-et-juliette",
    day: "22",
    month: "août",
    title: "Roméo & Juliette",
    subtitle: "Comédie-Française",
    city: "1er arr., Paris",
    emoji: "🎭",
    band: "from-amber-700 via-orange-800 to-orange-950",
    badge: "Places limitées",
    category: "Théâtre",
    priceLabel: "À partir de 18 €",
  },
  {
    id: "festival-ile-de-france",
    day: "30",
    month: "août",
    title: "Festival Île de France",
    subtitle: "Bois de Vincennes",
    city: "Vincennes, Paris",
    emoji: "🌲",
    band: "from-emerald-700 via-emerald-800 to-green-950",
    category: "Festival",
    priceLabel: "Gratuit",
    free: true,
  },
  {
    id: "psg-vs-ol",
    day: "05",
    month: "sept.",
    title: "PSG vs Olympique Lyonnais",
    subtitle: "Ligue 1 — Parc des Princes",
    city: "Paris, 16e",
    emoji: "⚽",
    band: "from-red-700 via-rose-800 to-rose-950",
    badge: "VIP dispo",
    category: "Sport",
    priceLabel: "À partir de 55 €",
  },
  {
    id: "paris-tech-summit",
    day: "18",
    month: "sept.",
    title: "Paris Tech Summit 2026",
    subtitle: "Palais des Congrès",
    city: "Paris, 17e",
    emoji: "💡",
    band: "from-blue-700 via-blue-800 to-indigo-950",
    category: "Conférence",
    priceLabel: "À partir de 120 €",
  },
  {
    id: "jazz-a-saint-germain",
    day: "10",
    month: "sept.",
    title: "Jazz à Saint-Germain",
    subtitle: "Caveau de la Huchette",
    city: "6e arrondissement",
    emoji: "🎷",
    band: "from-sky-800 via-blue-900 to-indigo-950",
    badge: "5 places restantes",
    category: "Concert",
    priceLabel: "À partir de 22 €",
  },
];

export const allEvents: MockEvent[] = [
  ...featuredEvents,
  {
    id: "marathon-de-paris",
    day: "12",
    month: "oct.",
    title: "Marathon de Paris",
    city: "Champs-Élysées, Paris",
    emoji: "🏃",
    band: "from-red-700 via-orange-800 to-amber-950",
    badge: "Dossards limités",
    category: "Sport",
    priceLabel: "À partir de 45 €",
  },
  {
    id: "salon-du-livre",
    day: "20",
    month: "oct.",
    title: "Salon du Livre",
    subtitle: "Porte de Versailles",
    city: "15e arrondissement",
    emoji: "📚",
    band: "from-blue-700 via-sky-800 to-indigo-950",
    category: "Conférence",
    priceLabel: "À partir de 12 €",
  },
  {
    id: "stand-up-comedy-night",
    day: "03",
    month: "oct.",
    title: "Stand-up Comedy Night",
    subtitle: "Le Point Virgule",
    city: "4e arrondissement",
    emoji: "🎙️",
    band: "from-amber-700 via-orange-800 to-orange-950",
    badge: "Dernières places",
    category: "Théâtre",
    priceLabel: "À partir de 20 €",
  },
  {
    id: "techno-warehouse",
    day: "25",
    month: "oct.",
    title: "Techno Warehouse",
    city: "Bercy, Paris",
    emoji: "🔊",
    band: "from-slate-700 via-slate-800 to-slate-950",
    category: "Concert",
    priceLabel: "À partir de 28 €",
  },
];

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
