// Présentation des paramètres de la plateforme : titre des sections et
// libellé lisible de chaque réglage. Le rangement par section et les droits
// d'accès (super admin) viennent du serveur (admin-service,
// setting-catalog.ts) — ici, uniquement l'habillage.

export type SettingFormat = "number" | "ratio" | "thresholds" | "text";

export interface SectionMeta {
  icon: string;
  title: string;
  description: string;
}

export interface FieldMeta {
  label: string;
  unit?: string;
  help?: string;
  // ratio : stocké 0.20, saisi et affiché 20 (%). thresholds : liste JSON
  // saisie « 25, 50, 75, 100 ».
  format?: SettingFormat;
}

export const SECTION_ORDER = [
  "security",
  "tickets",
  "events",
  "orders",
  "fees",
  "payment_fees",
  "payouts",
  "notifications",
  "legal",
  "other",
];

export const SECTIONS: Record<string, SectionMeta> = {
  security: {
    icon: "🔒",
    title: "Sécurité des comptes",
    description: "Mots de passe, âge minimum, verrouillage après échecs, durée et renouvellement des sessions.",
  },
  tickets: {
    icon: "🎫",
    title: "Billets et QR codes",
    description: "QR code dynamique, transferts entre comptes, revente et session des agents de contrôle.",
  },
  events: {
    icon: "📅",
    title: "Événements",
    description: "Validation des soumissions, archivage, annulation par l'acheteur et alertes de remplissage.",
  },
  orders: {
    icon: "🛒",
    title: "Commandes et stock",
    description: "Réservation temporaire des places et abandon des paniers.",
  },
  fees: {
    icon: "💶",
    title: "Commissions et TVA",
    description: "Taux de TVA, commissions de la plateforme et frais des billets gratuits.",
  },
  payment_fees: {
    icon: "💳",
    title: "Frais des moyens de paiement",
    description: "Frais prélevés par chaque prestataire, déduits des reversements.",
  },
  payouts: {
    icon: "🏦",
    title: "Reversements et litiges",
    description: "Délais de reversement aux organisateurs et gestion des litiges.",
  },
  notifications: {
    icon: "✉️",
    title: "Emails et documents",
    description: "Nouvelles tentatives d'envoi d'email et de génération des factures.",
  },
  legal: {
    icon: "⚖️",
    title: "Informations légales",
    description: "Mentions affichées sur les factures et les pages légales.",
  },
  other: {
    icon: "⚙️",
    title: "Autres paramètres",
    description: "Réglages non classés.",
  },
};

export const FIELDS: Record<string, FieldMeta> = {
  // Sécurité
  password_min_length: { label: "Longueur minimale du mot de passe", unit: "caractères", help: "En plus d'une majuscule, d'une minuscule, d'un chiffre et d'un caractère spécial" },
  minimum_signup_age: { label: "Âge minimum pour s'inscrire", unit: "ans", help: "Vérifié sur la date de naissance à l'inscription" },
  account_lockout_threshold: { label: "Tentatives avant verrouillage du compte", unit: "échecs" },
  account_lockout_duration_minutes: { label: "Durée du verrouillage", unit: "minutes" },
  session_idle_timeout_minutes: { label: "Déconnexion après inactivité", unit: "minutes", help: "Vérifiée aussi par le serveur" },
  session_max_duration_hours: { label: "Durée maximale d'une session", unit: "heures", help: "Reconnexion obligatoire ensuite, même en restant actif" },
  session_refresh_grace_seconds: { label: "Délai de grâce entre onglets", unit: "secondes", help: "Évite une déconnexion quand plusieurs onglets renouvellent la session en même temps" },
  sensitive_action_reauth_minutes: { label: "Connexion récente exigée pour une action sensible", unit: "minutes", help: "Ex. offrir un billet" },
  // Billets
  ticket_qr_rotation_seconds: { label: "Renouvellement du QR code", unit: "secondes", help: "Une capture d'écran n'est plus acceptée après ce délai" },
  ticket_qr_rotation_tolerance_steps: { label: "Tolérance du QR code au scan", unit: "période(s)", help: "Décalage d'horloge toléré" },
  scan_opens_before_minutes: { label: "Ouverture du contrôle", unit: "min avant le début", help: "Avant, un billet scanné est refusé (trop tôt)" },
  scan_closes_after_minutes: { label: "Fermeture du contrôle", unit: "min après la fin", help: "Après, un billet scanné est refusé (trop tard)" },
  ticket_qr_display_seconds: { label: "Affichage du QR code", unit: "secondes", help: "Masqué automatiquement ensuite" },
  ticket_transfer_max_per_ticket: { label: "Transferts maximum par billet", unit: "transfert(s)", help: "0 désactive le don de billets" },
  ticket_transfer_cutoff_hours: { label: "Fermeture des transferts", unit: "heures avant l'événement" },
  resale_reservation_minutes: { label: "Réservation d'un billet en revente", unit: "minutes", help: "Le temps pour l'acheteur de payer" },
  agent_session_hours: { label: "Session d'un agent de contrôle", unit: "heures" },
  // Événements
  event_validation_deadline_hours: { label: "Délai de traitement d'une soumission", unit: "heures" },
  event_archive_delay_days: { label: "Archivage après la fin de l'événement", unit: "jours" },
  cancel_deadline_hours: { label: "Annulation par l'acheteur possible jusqu'à", unit: "heures avant l'événement" },
  fill_thresholds: { label: "Paliers d'alerte de remplissage", unit: "%", help: "Séparés par des virgules, ex. 25, 50, 75, 100", format: "thresholds" },
  // Commandes
  stock_reservation_ttl_seconds: { label: "Réservation des places pendant l'achat", unit: "secondes" },
  order_abandon_timeout_minutes: { label: "Abandon automatique d'une commande non payée", unit: "minutes" },
  // Commissions et TVA
  tva_rate: { label: "Taux de TVA", unit: "%", format: "ratio" },
  commission_standard_percent: { label: "Commission standard", unit: "% du HT" },
  commission_large_event_percent: { label: "Commission grand événement", unit: "% du HT" },
  large_event_threshold: { label: "Seuil « grand événement »", unit: "places" },
  free_ticket_fee_eur: { label: "Frais par billet gratuit", unit: "€", help: "À la charge de l'organisateur" },
  // Frais de paiement
  stripe_fee_percent: { label: "Stripe — frais variables", unit: "%" },
  stripe_fee_fixed_eur: { label: "Stripe — frais fixes", unit: "€ par paiement" },
  paypal_fee_percent: { label: "PayPal — frais variables", unit: "%" },
  paypal_fee_fixed_eur: { label: "PayPal — frais fixes", unit: "€ par paiement" },
  orange_money_fee_percent: { label: "Orange Money — frais variables", unit: "%" },
  orange_money_fee_fixed_eur: { label: "Orange Money — frais fixes", unit: "€ par paiement" },
  wave_fee_percent: { label: "Wave — frais variables", unit: "%" },
  wave_fee_fixed_eur: { label: "Wave — frais fixes", unit: "€ par paiement" },
  // Reversements et litiges
  payout_delay_days: { label: "Délai de reversement après l'événement", unit: "jours" },
  payout_early_request_min_days_after_event: { label: "Reversement anticipé possible après", unit: "jours" },
  dispute_alert_threshold: { label: "Seuil d'alerte des litiges", unit: "litiges" },
  dispute_payout_block_max_days: { label: "Blocage maximal des fonds en litige", unit: "jours" },
  refund_alert_threshold_24h: { label: "Alerte « remboursements massifs »", unit: "remboursements en 24 h" },
  // Emails et documents
  email_max_retry_attempts: { label: "Tentatives d'envoi d'un email", unit: "tentatives" },
  email_retry_delay_minutes: { label: "Délai entre deux tentatives d'email", unit: "minutes" },
  pdf_generation_max_retry_attempts: { label: "Tentatives de génération d'une facture", unit: "tentatives" },
  ticket_pdf_wait_max_attempts: { label: "Attente de la facture avant l'email", unit: "vérifications" },
  ticket_pdf_wait_delay_seconds: { label: "Délai entre deux vérifications", unit: "secondes" },
  // Informations légales
  platform_legal_name: { label: "Raison sociale", format: "text" },
  platform_siret: { label: "SIRET", format: "text" },
  platform_vat_number: { label: "Numéro de TVA intracommunautaire", format: "text" },
  platform_address: { label: "Adresse du siège", format: "text" },
};

/** Libellé lisible d'un réglage (repli : sa description serveur, puis sa clé). */
export function settingLabel(key: string, fallback?: string | null): string {
  return FIELDS[key]?.label ?? fallback ?? key;
}

/** Valeur stockée → valeur saisie. */
export function toInput(key: string, stored: string): string {
  const format = FIELDS[key]?.format;
  if (format === "ratio") return String(Math.round(Number(stored) * 10000) / 100);
  if (format === "thresholds") {
    try {
      return (JSON.parse(stored) as number[]).join(", ");
    } catch {
      return stored;
    }
  }
  return stored;
}

/** Valeur saisie → valeur stockée (null si la saisie est invalide). */
export function fromInput(key: string, input: string): string | null {
  const format = FIELDS[key]?.format;
  const trimmed = input.trim();
  if (format === "ratio") {
    const percent = Number(trimmed.replace(",", "."));
    return trimmed === "" || !Number.isFinite(percent) ? null : String(Math.round(percent * 100) / 10000);
  }
  if (format === "thresholds") {
    const values = trimmed.split(/[,;\s]+/).filter(Boolean).map(Number);
    return values.length === 0 || values.some((value) => !Number.isFinite(value)) ? null : JSON.stringify(values);
  }
  if (format === "text") return trimmed;
  return trimmed.replace(",", ".");
}
