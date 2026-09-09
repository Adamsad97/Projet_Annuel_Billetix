// Données de démonstration pour le dashboard admin — aucun appel API,
// à remplacer par les vraies données (admin-service) lors du câblage.

export interface AdminNavItem {
  id: string;
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

export interface AdminNavSection {
  id: string;
  label: string;
  items: AdminNavItem[];
}

export const adminNavSections: AdminNavSection[] = [
  {
    id: "principal",
    label: "Principal",
    items: [
      { id: "dashboard", href: "/admin", label: "Dashboard", icon: "📊" },
      {
        id: "validation",
        href: "/admin/validation",
        label: "Validation",
        icon: "✅",
        badge: 4,
      },
      {
        id: "users",
        href: "/admin/utilisateurs",
        label: "Utilisateurs",
        icon: "👥",
      },
      {
        id: "events",
        href: "/admin/evenements",
        label: "Événements",
        icon: "✏️",
      },
    ],
  },
  {
    id: "finances",
    label: "Finances",
    items: [
      {
        id: "payouts",
        href: "/admin/reversements",
        label: "Reversements",
        icon: "💰",
      },
      {
        id: "disputes",
        href: "/admin/litiges",
        label: "Litiges",
        icon: "⚠️",
        badge: 3,
      },
      {
        id: "commissions",
        href: "/admin/commissions",
        label: "Commissions",
        icon: "☑️",
      },
    ],
  },
  {
    id: "systeme",
    label: "Système",
    items: [
      {
        id: "audit",
        href: "/admin/audit-trail",
        label: "Audit trail",
        icon: "📄",
      },
      {
        id: "settings",
        href: "/admin/parametres",
        label: "Paramètres",
        icon: "⚙️",
      },
      {
        id: "categories",
        href: "/admin/categories",
        label: "Catégories",
        icon: "🏷️",
      },
      {
        id: "newsletter",
        href: "/admin/newsletter",
        label: "Newsletter",
        icon: "📧",
      },
    ],
  },
];

export interface AdminStat {
  id: string;
  label: string;
  value: string;
  valueClassName?: string;
}

export const adminStats: AdminStat[] = [
  {
    id: "active-events",
    label: "Événements actifs",
    value: "128",
    valueClassName: "text-white",
  },
  {
    id: "monthly-sales",
    label: "Ventes du mois",
    value: "98 400 €",
    valueClassName: "text-emerald-400",
  },
  {
    id: "commissions",
    label: "Commissions",
    value: "9 840 €",
    valueClassName: "text-white",
  },
  {
    id: "open-disputes",
    label: "Litiges ouverts",
    value: "3",
    valueClassName: "text-red-400",
  },
];

export interface SubmittedDocument {
  id: string;
  label: string;
  kind: "poster" | "justificatif";
  band: string;
  emoji: string;
  fileLabel: string;
}

export interface ValidationRequest {
  id: string;
  title: string;
  emoji: string;
  iconBg: string;
  nonProfit?: boolean;
  metaParts: string[];
  description: string;
  documents: SubmittedDocument[];
}

export const validationQueue: ValidationRequest[] = [
  {
    id: "paris-tech-summit",
    title: "Paris Tech Summit 2026",
    emoji: "💡",
    iconBg: "bg-amber-500/15",
    metaParts: [
      "Adama Diawara",
      "Soumis il y a 2h",
      "120 €/billet",
      "Conférence",
    ],
    description:
      "Conférence tech réunissant 800 participants au Palais des Congrès, avec keynotes et ateliers sur l'IA et le cloud.",
    documents: [
      {
        id: "poster",
        label: "Affiche de l'événement",
        kind: "poster",
        band: "from-blue-700 via-blue-800 to-indigo-950",
        emoji: "💡",
        fileLabel: "affiche-paris-tech-summit.jpg",
      },
    ],
  },
  {
    id: "soiree-jazz-club",
    title: "Soirée Jazz Club — Caveau de la Huchette",
    emoji: "🎷",
    iconBg: "bg-violet-500/15",
    metaParts: ["Marie Koné", "Soumis il y a 5h", "22 €/billet", "Concert"],
    description:
      "Soirée jazz intimiste dans le caveau historique du 5e arrondissement, quartet invité pour la soirée.",
    documents: [
      {
        id: "poster",
        label: "Affiche de l'événement",
        kind: "poster",
        band: "from-sky-800 via-blue-900 to-indigo-950",
        emoji: "🎷",
        fileLabel: "affiche-soiree-jazz.jpg",
      },
    ],
  },
  {
    id: "gala-caritatif",
    title: "Gala Caritatif — Hôpital Necker",
    emoji: "❤️",
    iconBg: "bg-rose-500/15",
    nonProfit: true,
    metaParts: [
      "Association Sourire",
      "Soumis il y a 1j",
      "Gratuit",
      "Justificatif fourni",
    ],
    description:
      "Soirée de collecte de fonds au profit des services pédiatriques de l'Hôpital Necker, organisée par l'association Sourire (loi 1901).",
    documents: [
      {
        id: "poster",
        label: "Affiche de l'événement",
        kind: "poster",
        band: "from-rose-700 via-rose-800 to-pink-950",
        emoji: "❤️",
        fileLabel: "affiche-gala-caritatif.jpg",
      },
      {
        id: "justificatif",
        label: "Justificatif association loi 1901",
        kind: "justificatif",
        band: "from-gray-700 via-gray-800 to-gray-900",
        emoji: "📄",
        fileLabel: "recepisse-association-sourire.pdf",
      },
    ],
  },
  {
    id: "tournoi-football-amateur",
    title: "Tournoi Football Amateur — Stade Charlety",
    emoji: "⚽",
    iconBg: "bg-red-500/15",
    metaParts: ["FC Paris 13", "Soumis il y a 2j", "8 €/billet", "Sport"],
    description:
      "Tournoi inter-quartiers organisé par le club FC Paris 13, ouvert au public, buvette et animations sur place.",
    documents: [
      {
        id: "poster",
        label: "Affiche de l'événement",
        kind: "poster",
        band: "from-red-700 via-orange-800 to-amber-950",
        emoji: "⚽",
        fileLabel: "affiche-tournoi-fc-paris-13.jpg",
      },
    ],
  },
];

export interface ValidationHistoryEntry {
  id: string;
  title: string;
  emoji: string;
  iconBg: string;
  organizer: string;
  decidedLabel: string;
  reason?: string;
}

export const validationHistory: {
  approved: ValidationHistoryEntry[];
  rejected: ValidationHistoryEntry[];
} = {
  approved: [
    {
      id: "nuit-electronique",
      title: "Nuit Électronique",
      emoji: "🎧",
      iconBg: "bg-violet-500/15",
      organizer: "Adama Diawara",
      decidedLabel: "Validé le 2 juillet 2026",
    },
    {
      id: "festival-ile-de-france",
      title: "Festival Île de France",
      emoji: "🌲",
      iconBg: "bg-emerald-500/15",
      organizer: "Ville de Paris",
      decidedLabel: "Validé le 28 juin 2026",
    },
    {
      id: "psg-vs-ol",
      title: "PSG vs Olympique Lyonnais",
      emoji: "⚽",
      iconBg: "bg-rose-500/15",
      organizer: "Paris Saint-Germain",
      decidedLabel: "Validé le 20 juin 2026",
    },
  ],
  rejected: [
    {
      id: "loto-inconnu",
      title: "Grand Loto du Quartier",
      emoji: "🎰",
      iconBg: "bg-gray-500/15",
      organizer: "Compte non vérifié",
      decidedLabel: "Rejeté le 15 juin 2026",
      reason: "Justificatif d'identité manquant",
    },
    {
      id: "concert-sans-lieu",
      title: "Concert Surprise",
      emoji: "🎤",
      iconBg: "bg-gray-500/15",
      organizer: "Jean D.",
      decidedLabel: "Rejeté le 10 juin 2026",
      reason: "Lieu non confirmé par le prestataire",
    },
  ],
};
