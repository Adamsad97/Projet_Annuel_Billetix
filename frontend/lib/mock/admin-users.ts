// Données de démonstration pour la gestion des utilisateurs — aucun appel
// API, à remplacer par les vraies données (user-service / auth-service)
// lors du câblage.

export type UserRole = "Acheteur" | "Organisateur" | "Admin";
export type UserStatus = "active" | "suspended";

export interface KycStatus {
  status: "verified" | "pending" | "none";
  documents: { id: string; label: string; url: string }[];
}

export interface AdminUser {
  id: string;
  initials: string;
  name: string;
  email: string;
  roles: UserRole[];
  status: UserStatus;
  joinedLabel: string;
  kyc?: KycStatus;
}

export const adminUsers: AdminUser[] = [
  {
    id: "u1",
    initials: "AD",
    name: "Adama Diawara",
    email: "adama.diawara@email.com",
    roles: ["Acheteur", "Organisateur"],
    status: "active",
    joinedLabel: "Mai 2026",
    kyc: {
      status: "verified",
      documents: [
        {
          id: "id-front",
          label: "Pièce d'identité (recto)",
          url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='400' height='500' fill='%2312101c'/%3E%3C/svg%3E",
        },
        {
          id: "id-back",
          label: "Pièce d'identité (verso)",
          url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='400' height='500' fill='%2312101c'/%3E%3C/svg%3E",
        },
      ],
    },
  },
  {
    id: "u2",
    initials: "MK",
    name: "Marie Koné",
    email: "marie.kone@email.com",
    roles: ["Organisateur"],
    status: "active",
    joinedLabel: "Mars 2026",
    kyc: {
      status: "pending",
      documents: [
        {
          id: "id-front",
          label: "Pièce d'identité (recto)",
          url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='400' height='500' fill='%2312101c'/%3E%3C/svg%3E",
        },
      ],
    },
  },
  {
    id: "u3",
    initials: "JD",
    name: "Jean Dupont",
    email: "jean.dupont@email.com",
    roles: ["Acheteur"],
    status: "active",
    joinedLabel: "Juin 2026",
  },
  {
    id: "u4",
    initials: "SL",
    name: "Sophie Lambert",
    email: "sophie.lambert@email.com",
    roles: ["Admin"],
    status: "active",
    joinedLabel: "Janvier 2025",
  },
  {
    id: "u5",
    initials: "KB",
    name: "Karim Benali",
    email: "karim.benali@email.com",
    roles: ["Organisateur"],
    status: "suspended",
    joinedLabel: "Février 2026",
  },
  {
    id: "u6",
    initials: "LT",
    name: "Léa Tran",
    email: "lea.tran@email.com",
    roles: ["Acheteur"],
    status: "active",
    joinedLabel: "Juillet 2026",
  },
  {
    id: "u7",
    initials: "FP",
    name: "FC Paris 13",
    email: "contact@fcparis13.fr",
    roles: ["Organisateur"],
    status: "active",
    joinedLabel: "Avril 2026",
  },
];

export const userRoleFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "Acheteur", label: "Acheteurs" },
  { id: "Organisateur", label: "Organisateurs" },
  { id: "Admin", label: "Admins" },
];
