// Données de démonstration pour la gestion globale des événements — aucun
// appel API, à remplacer par les vraies données (event-service) lors du
// câblage.

export type AdminEventStatus =
  | "published"
  | "pending"
  | "draft"
  | "archived"
  | "cancelled";

export interface AdminEvent {
  id: string;
  title: string;
  organizer: string;
  category: string;
  dateLabel: string;
  emoji: string;
  iconBg: string;
  status: AdminEventStatus;
  ticketsLabel: string;
}

export const adminEvents: AdminEvent[] = [
  {
    id: "nuit-electronique",
    title: "Nuit Électronique",
    organizer: "Adama Diawara",
    category: "Concert",
    dateLabel: "15 août 2026",
    emoji: "🎧",
    iconBg: "bg-blue-500/15",
    status: "published",
    ticketsLabel: "720 / 1 000",
  },
  {
    id: "paris-tech-summit",
    title: "Paris Tech Summit 2026",
    organizer: "Adama Diawara",
    category: "Conférence",
    dateLabel: "18 sept. 2026",
    emoji: "💡",
    iconBg: "bg-amber-500/15",
    status: "pending",
    ticketsLabel: "—",
  },
  {
    id: "festival-ile-de-france",
    title: "Festival Île de France",
    organizer: "Ville de Paris",
    category: "Festival",
    dateLabel: "30 août 2026",
    emoji: "🌲",
    iconBg: "bg-emerald-500/15",
    status: "published",
    ticketsLabel: "450 / 1 000",
  },
  {
    id: "psg-vs-ol",
    title: "PSG vs Olympique Lyonnais",
    organizer: "Paris Saint-Germain",
    category: "Sport",
    dateLabel: "5 sept. 2026",
    emoji: "⚽",
    iconBg: "bg-rose-500/15",
    status: "published",
    ticketsLabel: "38 200 / 47 000",
  },
  {
    id: "romeo-et-juliette",
    title: "Roméo & Juliette",
    organizer: "Comédie-Française",
    category: "Théâtre",
    dateLabel: "12 juin 2026",
    emoji: "🎭",
    iconBg: "bg-orange-500/15",
    status: "archived",
    ticketsLabel: "980 / 980",
  },
  {
    id: "brocante-vide-greniers",
    title: "Grande Brocante du 15e",
    organizer: "Comité de quartier",
    category: "Autre",
    dateLabel: "22 mai 2026",
    emoji: "📦",
    iconBg: "bg-gray-500/15",
    status: "cancelled",
    ticketsLabel: "12 / 300",
  },
  {
    id: "soiree-jazz-club",
    title: "Soirée Jazz Club — Caveau de la Huchette",
    organizer: "Marie Koné",
    category: "Concert",
    dateLabel: "8 oct. 2026",
    emoji: "🎷",
    iconBg: "bg-sky-500/15",
    status: "draft",
    ticketsLabel: "—",
  },
];

export const eventStatusBadge: Record<
  AdminEventStatus,
  { label: string; className: string }
> = {
  published: {
    label: "● Publié",
    className:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  },
  pending: {
    label: "⏳ En validation",
    className:
      "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  },
  draft: {
    label: "Brouillon",
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
  archived: {
    label: "Archivé",
    className: "bg-hairline-1 text-ink-4 ring-1 ring-inset ring-hairline-2",
  },
  cancelled: {
    label: "✕ Annulé",
    className: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  },
};

export const eventStatusFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "published", label: "Publiés" },
  { id: "pending", label: "En validation" },
  { id: "draft", label: "Brouillons" },
  { id: "archived", label: "Archivés" },
  { id: "cancelled", label: "Annulés" },
];
