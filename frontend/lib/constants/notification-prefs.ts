import { msg } from "@/lib/i18n/translate";
// Préférences de notification : libellés et valeurs par défaut — les choix
// de l'utilisateur sont lus et enregistrés via lib/api/notification-prefs.ts.

export interface NotificationPref {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  locked?: boolean;
}

export const notificationPrefGroups: { title: string; prefs: NotificationPref[] }[] = [
  {
    title: msg("Commandes & billets"),
    prefs: [
      {
        id: "order-confirmation",
        label: msg("Confirmation de commande"),
        description: msg("Reçu et billets envoyés après un achat"),
        defaultEnabled: true,
        locked: true,
      },
      {
        id: "event-reminder",
        label: msg("Rappel avant l'événement"),
        description: msg("Email envoyé 24h avant la date"),
        defaultEnabled: true,
      },
      {
        id: "resale-updates",
        label: msg("Suivi de revente"),
        description: msg("Quand un de vos billets est mis en vente ou vendu"),
        defaultEnabled: true,
      },
    ],
  },
  {
    title: msg("Organisateur"),
    prefs: [
      {
        id: "event-validated",
        label: msg("Validation d'événement"),
        description: msg("Quand un événement soumis est validé ou rejeté"),
        defaultEnabled: true,
        locked: true,
      },
      {
        id: "payout-sent",
        label: msg("Reversement effectué"),
        description: msg("Confirmation d'un virement vers votre compte"),
        defaultEnabled: true,
        locked: true,
      },
      {
        id: "low-stock",
        label: msg("Alerte de remplissage"),
        description: msg("Quand un événement approche de la complet"),
        defaultEnabled: true,
      },
    ],
  },
  {
    title: msg("Marketing"),
    prefs: [
      {
        id: "recommendations",
        label: msg("Recommandations d'événements"),
        description: msg("Suggestions basées sur vos achats précédents"),
        defaultEnabled: false,
      },
      {
        id: "newsletter",
        label: "Newsletter BilleTix",
        description: msg("Actualités et nouveautés de la plateforme"),
        defaultEnabled: false,
      },
    ],
  },
];
