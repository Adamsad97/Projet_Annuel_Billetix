// Navigation de l'espace Admin — les données KPIs/file de validation sont
// réelles (cf. lib/api/admin.ts, lib/mappers/admin-mappers.ts).

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
      {
        id: "transfers",
        href: "/admin/transferts",
        label: "Billets offerts",
        icon: "🎁",
      },
      {
        id: "resales",
        href: "/admin/reventes",
        label: "Reventes",
        icon: "🔄",
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
