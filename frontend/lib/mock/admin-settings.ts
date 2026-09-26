// Données de démonstration pour la page paramètres — reflète les vraies
// clés de platform_settings (admin-service) telles que construites au fil
// du projet, mais reste un formulaire purement visuel : aucune lecture ni
// écriture réelle tant que le câblage n'est pas fait.

export type SettingFieldType = "number" | "text" | "percent";

export interface SettingField {
  key: string;
  label: string;
  description?: string;
  value: string;
  unit?: string;
  type: SettingFieldType;
}

export interface SettingsSection {
  id: string;
  icon: string;
  title: string;
  description: string;
  fields: SettingField[];
}

export const settingsSections: SettingsSection[] = [
  {
    id: "security",
    icon: "🔒",
    title: "Sécurité des comptes",
    description: "Mots de passe, sessions, verrouillage après échecs de connexion et durée de session agent.",
    fields: [
      {
        key: "session_idle_timeout_minutes",
        label: "Déconnexion après inactivité",
        description: "Avertissement une minute avant ; vérifié aussi par le serveur",
        value: "30",
        unit: "minutes",
        type: "number",
      },
      {
        key: "ticket_qr_rotation_seconds",
        label: "Renouvellement du QR code dynamique",
        description: "Une capture d'écran n'est plus acceptée après ce délai (plus la tolérance)",
        value: "5",
        unit: "secondes",
        type: "number",
      },
      {
        key: "ticket_qr_rotation_tolerance_steps",
        label: "Tolérance du QR dynamique au scan",
        description: "Périodes voisines encore acceptées (décalage d'horloge)",
        value: "1",
        unit: "période(s)",
        type: "number",
      },
      {
        key: "ticket_qr_display_seconds",
        label: "Affichage du QR code d'un billet",
        description: "Masqué automatiquement ensuite dans l'espace acheteur",
        value: "60",
        unit: "secondes",
        type: "number",
      },
      {
        key: "session_max_duration_hours",
        label: "Durée maximale d'une session",
        description: "Reconnexion obligatoire ensuite, même en restant actif",
        value: "12",
        unit: "heures",
        type: "number",
      },
      {
        key: "minimum_signup_age",
        label: "Âge minimum pour s'inscrire",
        description: "Vérifié sur la date de naissance à l'inscription",
        value: "18",
        unit: "ans",
        type: "number",
      },
      {
        key: "password_min_length",
        label: "Longueur minimale du mot de passe",
        description: "En plus d'une majuscule, une minuscule, un chiffre et un caractère spécial",
        value: "12",
        unit: "caractères",
        type: "number",
      },
      {
        key: "account_lockout_threshold",
        label: "Tentatives avant verrouillage",
        value: "5",
        type: "number",
      },
      {
        key: "account_lockout_duration_minutes",
        label: "Durée du verrouillage",
        value: "30",
        unit: "minutes",
        type: "number",
      },
      {
        key: "agent_session_hours",
        label: "Durée de session agent de contrôle",
        value: "8",
        unit: "heures",
        type: "number",
      },
    ],
  },
  {
    id: "events",
    icon: "🎫",
    title: "Événements",
    description: "Délais de validation, d'archivage et d'annulation.",
    fields: [
      {
        key: "event_validation_deadline_hours",
        label: "Délai de traitement d'une soumission",
        value: "48",
        unit: "heures",
        type: "number",
      },
      {
        key: "event_archive_delay_days",
        label: "Archivage automatique après la fin",
        value: "30",
        unit: "jours",
        type: "number",
      },
      {
        key: "cancel_deadline_hours",
        label: "Délai limite d'annulation par l'acheteur",
        value: "24",
        unit: "heures avant l'événement",
        type: "number",
      },
      {
        key: "fill_thresholds",
        label: "Seuils d'alerte de remplissage",
        description: "Paliers déclenchant une notification à l'organisateur",
        value: "50, 80, 95",
        unit: "%",
        type: "text",
      },
    ],
  },
  {
    id: "orders",
    icon: "🛒",
    title: "Commandes & stock",
    description: "Réservation de stock et délais d'abandon de panier.",
    fields: [
      {
        key: "stock_reservation_ttl_seconds",
        label: "Durée de réservation du stock",
        value: "600",
        unit: "secondes",
        type: "number",
      },
      {
        key: "order_abandon_timeout_minutes",
        label: "Abandon automatique du panier",
        value: "15",
        unit: "minutes",
        type: "number",
      },
      {
        key: "resale_reservation_minutes",
        label: "Réservation billet en revente",
        value: "10",
        unit: "minutes",
        type: "number",
      },
    ],
  },
  {
    id: "payouts",
    icon: "💰",
    title: "Reversements & litiges",
    description: "Règles de versement aux organisateurs et seuils d'alerte.",
    fields: [
      {
        key: "payout_early_request_min_days_after_event",
        label: "Délai minimum avant reversement anticipé",
        description: "CDC 7.2",
        value: "2",
        unit: "jours (J+2)",
        type: "number",
      },
      {
        key: "dispute_payout_block_max_days",
        label: "Blocage max des fonds en litige",
        value: "90",
        unit: "jours",
        type: "number",
      },
      {
        key: "dispute_alert_threshold",
        label: "Seuil d'alerte litiges",
        description: "Nombre de litiges déclenchant une alerte admin",
        value: "5",
        type: "number",
      },
      {
        key: "refund_alert_threshold_24h",
        label: "Seuil d'alerte remboursements / 24h",
        value: "10",
        type: "number",
      },
    ],
  },
  {
    id: "notifications",
    icon: "📧",
    title: "Notifications & génération PDF",
    description: "Tentatives et délais avant abandon définitif + alerte admin.",
    fields: [
      {
        key: "email_max_retry_attempts",
        label: "Tentatives d'envoi d'email",
        value: "5",
        type: "number",
      },
      {
        key: "email_retry_delay_minutes",
        label: "Délai entre tentatives d'email",
        value: "15",
        unit: "minutes",
        type: "number",
      },
      {
        key: "pdf_generation_max_retry_attempts",
        label: "Tentatives de génération PDF",
        description: "Billet et facture",
        value: "5",
        type: "number",
      },
      {
        key: "ticket_pdf_wait_max_attempts",
        label: "Tentatives d'attente du PDF billet",
        value: "10",
        type: "number",
      },
      {
        key: "ticket_pdf_wait_delay_seconds",
        label: "Délai entre tentatives d'attente",
        value: "3",
        unit: "secondes",
        type: "number",
      },
    ],
  },
  {
    id: "payments",
    icon: "💳",
    title: "Moyens de paiement alternatifs",
    description: "Frais appliqués sur Orange Money et Wave.",
    fields: [
      {
        key: "orange_money_fee_percent",
        label: "Orange Money — frais %",
        value: "2,5",
        unit: "%",
        type: "percent",
      },
      {
        key: "orange_money_fee_fixed_eur",
        label: "Orange Money — frais fixe",
        value: "0,10",
        unit: "€",
        type: "number",
      },
      {
        key: "wave_fee_percent",
        label: "Wave — frais %",
        value: "1,8",
        unit: "%",
        type: "percent",
      },
      {
        key: "wave_fee_fixed_eur",
        label: "Wave — frais fixe",
        value: "0,10",
        unit: "€",
        type: "number",
      },
    ],
  },
  {
    id: "legal",
    icon: "📄",
    title: "Informations légales",
    description: "Affichées sur les factures et mentions légales.",
    fields: [
      {
        key: "platform_legal_name",
        label: "Raison sociale",
        value: "BilletiX SAS",
        type: "text",
      },
      {
        key: "platform_siret",
        label: "SIRET",
        value: "123 456 789 00012",
        type: "text",
      },
      {
        key: "platform_vat_number",
        label: "Numéro de TVA",
        value: "FR12345678900",
        type: "text",
      },
      {
        key: "platform_address",
        label: "Adresse du siège",
        value: "1 rue de la Billetterie, 75001 Paris",
        type: "text",
      },
    ],
  },
];
