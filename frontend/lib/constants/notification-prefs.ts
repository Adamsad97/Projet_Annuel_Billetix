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
    title: "Commandes & billets",
    prefs: [
      {
        id: "order-confirmation",
        label: "Confirmation de commande",
        description: "Reçu et billets envoyés après un achat",
        defaultEnabled: true,
        locked: true,
      },
      {
        id: "event-reminder",
        label: "Rappel avant l'événement",
        description: "Email envoyé 24h avant la date",
        defaultEnabled: true,
      },
      {
        id: "resale-updates",
        label: "Suivi de revente",
        description: "Quand un de vos billets est mis en vente ou vendu",
        defaultEnabled: true,
      },
    ],
  },
  {
    title: "Organisateur",
    prefs: [
      {
        id: "event-validated",
        label: "Validation d'événement",
        description: "Quand un événement soumis est validé ou rejeté",
        defaultEnabled: true,
        locked: true,
      },
      {
        id: "payout-sent",
        label: "Reversement effectué",
        description: "Confirmation d'un virement vers votre compte",
        defaultEnabled: true,
        locked: true,
      },
      {
        id: "low-stock",
        label: "Alerte de remplissage",
        description: "Quand un événement approche de la complet",
        defaultEnabled: true,
      },
    ],
  },
  {
    title: "Marketing",
    prefs: [
      {
        id: "recommendations",
        label: "Recommandations d'événements",
        description: "Suggestions basées sur vos achats précédents",
        defaultEnabled: false,
      },
      {
        id: "newsletter",
        label: "Newsletter BilletiX",
        description: "Actualités et nouveautés de la plateforme",
        defaultEnabled: false,
      },
    ],
  },
];
