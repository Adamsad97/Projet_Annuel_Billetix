import { msg } from "@/lib/i18n/translate";
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
    label: msg("Principal"),
    items: [
      { id: "dashboard", href: "/admin", label: msg("Dashboard"), icon: "📊" },
      {
        id: "validation",
        href: "/admin/validation",
        label: msg("Validation"),
        icon: "✅",
      },
      {
        id: "users",
        href: "/admin/utilisateurs",
        label: msg("Utilisateurs"),
        icon: "👥",
      },
      {
        id: "kyc",
        href: "/admin/kyc",
        label: msg("Identités"),
        icon: "🪪",
      },
      {
        id: "events",
        href: "/admin/evenements",
        label: msg("Événements"),
        icon: "✏️",
      },
      {
        id: "cancellations",
        href: "/admin/annulations",
        label: msg("Annulations et reports"),
        icon: "🛑",
      },
      {
        id: "transfers",
        href: "/admin/transferts",
        label: msg("Billets offerts"),
        icon: "🎁",
      },
      {
        id: "resales",
        href: "/admin/reventes",
        label: msg("Reventes"),
        icon: "🔄",
      },
    ],
  },
  {
    id: "finances",
    label: msg("Finances"),
    items: [
      {
        id: "payouts",
        href: "/admin/reversements",
        label: msg("Reversements"),
        icon: "💰",
      },
      {
        id: "disputes",
        href: "/admin/litiges",
        label: msg("Litiges"),
        icon: "⚠️",
      },
      {
        id: "commissions",
        href: "/admin/commissions",
        label: msg("Commissions"),
        icon: "☑️",
      },
    ],
  },
  {
    id: "systeme",
    label: msg("Système"),
    items: [
      {
        id: "audit",
        href: "/admin/audit-trail",
        label: msg("Audit trail"),
        icon: "📄",
      },
      {
        id: "settings",
        href: "/admin/parametres",
        label: msg("Paramètres"),
        icon: "⚙️",
      },
      {
        id: "categories",
        href: "/admin/categories",
        label: msg("Catégories"),
        icon: "🏷️",
      },
      {
        id: "newsletter",
        href: "/admin/newsletter",
        label: msg("Newsletter"),
        icon: "📧",
      },
    ],
  },
];
