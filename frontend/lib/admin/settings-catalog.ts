import { msg, t } from "@/lib/i18n/translate";
// Habillage des paramètres (titres et libellés) ; sections et droits viennent du serveur.

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
    title: msg("Sécurité des comptes"),
    description: msg("Mots de passe, âge minimum, verrouillage après échecs, durée et renouvellement des sessions."),
  },
  tickets: {
    icon: "🎫",
    title: msg("Billets et QR codes"),
    description: msg("QR code dynamique, transferts entre comptes, revente et session des agents de contrôle."),
  },
  events: {
    icon: "📅",
    title: msg("Événements"),
    description: msg("Validation des soumissions, archivage, annulation par l'acheteur et alertes de remplissage."),
  },
  orders: {
    icon: "🛒",
    title: msg("Commandes et stock"),
    description: msg("Réservation temporaire des places et abandon des paniers."),
  },
  fees: {
    icon: "💶",
    title: msg("Commissions et TVA"),
    description: msg("Taux de TVA, commissions de la plateforme et frais des billets gratuits."),
  },
  payment_fees: {
    icon: "💳",
    title: msg("Frais des moyens de paiement"),
    description: msg("Frais prélevés par chaque prestataire, déduits des reversements."),
  },
  payouts: {
    icon: "🏦",
    title: msg("Reversements et litiges"),
    description: msg("Délais de reversement aux organisateurs et gestion des litiges."),
  },
  notifications: {
    icon: "✉️",
    title: msg("Emails et documents"),
    description: msg("Nouvelles tentatives d'envoi d'email et de génération des factures."),
  },
  legal: {
    icon: "⚖️",
    title: msg("Informations légales"),
    description: msg("Mentions affichées sur les factures et les pages légales."),
  },
  other: {
    icon: "⚙️",
    title: msg("Autres paramètres"),
    description: msg("Réglages non classés."),
  },
};

export const FIELDS: Record<string, FieldMeta> = {
  // Sécurité
  password_min_length: { label: msg("Longueur minimale du mot de passe"), unit: msg("caractères"), help: msg("En plus d'une majuscule, d'une minuscule, d'un chiffre et d'un caractère spécial") },
  password_max_age_days: { label: msg("Renouvellement obligatoire du mot de passe"), unit: msg("jours"), help: msg("Changement exigé à la connexion au-delà de ce délai (CNIL : 60). 0 = jamais") },
  magic_link_ttl_minutes: { label: msg("Validité du lien de connexion par email"), unit: msg("minutes"), help: msg("Connexion sans mot de passe, lien à usage unique (60 au maximum). 0 = désactivée") },
  minimum_signup_age: { label: msg("Âge minimum pour s'inscrire"), unit: msg("ans"), help: msg("Vérifié sur la date de naissance à l'inscription") },
  account_lockout_threshold: { label: msg("Tentatives avant verrouillage du compte"), unit: msg("échecs") },
  account_lockout_duration_minutes: { label: msg("Durée du verrouillage"), unit: msg("minutes") },
  session_idle_timeout_minutes: { label: msg("Déconnexion après inactivité"), unit: msg("minutes"), help: msg("Vérifiée aussi par le serveur") },
  session_max_duration_hours: { label: msg("Durée maximale d'une session"), unit: msg("heures"), help: msg("Reconnexion obligatoire ensuite, même en restant actif") },
  session_refresh_grace_seconds: { label: msg("Délai de grâce entre onglets"), unit: msg("secondes"), help: msg("Évite une déconnexion quand plusieurs onglets renouvellent la session en même temps") },
  sensitive_action_reauth_minutes: { label: msg("Connexion récente exigée pour une action sensible"), unit: msg("minutes"), help: msg("Ex. offrir un billet") },
  // Billets
  ticket_qr_rotation_seconds: { label: msg("Renouvellement du QR code"), unit: msg("secondes"), help: msg("Une capture d'écran n'est plus acceptée après ce délai") },
  ticket_qr_rotation_tolerance_steps: { label: msg("Tolérance du QR code au scan"), unit: msg("période(s)"), help: msg("Décalage d'horloge toléré") },
  scan_opens_before_minutes: { label: msg("Ouverture du contrôle"), unit: msg("min avant le début"), help: msg("Avant, un billet scanné est refusé (trop tôt)") },
  scan_closes_after_minutes: { label: msg("Fermeture du contrôle"), unit: msg("min après la fin"), help: msg("Après, un billet scanné est refusé (trop tard)") },
  ticket_qr_display_seconds: { label: msg("Affichage du QR code"), unit: msg("secondes"), help: msg("Masqué automatiquement ensuite") },
  ticket_transfer_max_per_ticket: { label: msg("Transferts maximum par billet"), unit: msg("transfert(s)"), help: msg("0 désactive le don de billets") },
  ticket_transfer_cutoff_hours: { label: msg("Fermeture des transferts"), unit: msg("heures avant l'événement") },
  resale_reservation_minutes: { label: msg("Réservation d'un billet en revente"), unit: msg("minutes"), help: msg("Le temps pour l'acheteur de payer") },
  agent_invitation_hours: { label: msg("Validité de l'invitation d'un agent"), unit: msg("heures"), help: msg("Délai pour choisir son mot de passe") },
  // Événements
  event_validation_deadline_hours: { label: msg("Délai de traitement d'une soumission"), unit: msg("heures") },
  event_archive_delay_days: { label: msg("Archivage après la fin de l'événement"), unit: msg("jours") },
  cancel_deadline_hours: { label: msg("Annulation par l'acheteur possible jusqu'à"), unit: msg("heures avant l'événement") },
  postponement_refund_days: { label: msg("Remboursement possible après un report pendant"), unit: msg("jours après l'annonce de la nouvelle date") },
  fill_thresholds: { label: msg("Paliers d'alerte de remplissage"), unit: "%", help: msg("Séparés par des virgules, ex. 25, 50, 75, 100"), format: "thresholds" },
  // Commandes
  stock_reservation_ttl_seconds: { label: msg("Réservation des places pendant l'achat"), unit: msg("secondes") },
  order_abandon_timeout_minutes: { label: msg("Abandon automatique d'une commande non payée"), unit: msg("minutes") },
  // Commissions et TVA
  commission_standard_percent: { label: msg("Commission standard"), unit: msg("% du HT") },
  commission_large_event_percent: { label: msg("Commission grand événement"), unit: msg("% du HT") },
  large_event_threshold: { label: msg("Seuil « grand événement »"), unit: msg("places") },
  free_ticket_fee_eur: { label: msg("Frais par billet gratuit"), unit: "€", help: msg("À la charge de l'organisateur") },
  // Frais de paiement
  stripe_fee_percent: { label: msg("Stripe — frais variables"), unit: "%" },
  stripe_fee_fixed_eur: { label: msg("Stripe — frais fixes"), unit: msg("€ par paiement") },
  // Reversements et litiges
  payout_delay_days: { label: msg("Délai de reversement après l'événement"), unit: msg("jours") },
  iban_change_payout_hold_hours: { label: msg("Reversements suspendus après un changement d'IBAN"), unit: msg("heures") },
  payout_early_request_min_days_after_event: { label: msg("Reversement anticipé possible après"), unit: msg("jours") },
  dispute_alert_threshold: { label: msg("Seuil d'alerte des litiges"), unit: msg("litiges") },
  dispute_payout_block_max_days: { label: msg("Blocage maximal des fonds en litige"), unit: msg("jours") },
  refund_alert_threshold_24h: { label: msg("Alerte « remboursements massifs »"), unit: msg("remboursements en 24 h") },
  // Emails et documents
  email_max_retry_attempts: { label: msg("Tentatives d'envoi d'un email"), unit: msg("tentatives") },
  email_retry_delay_minutes: { label: msg("Délai entre deux tentatives d'email"), unit: msg("minutes") },
  pdf_generation_max_retry_attempts: { label: msg("Tentatives de génération d'une facture"), unit: msg("tentatives") },
  ticket_pdf_wait_max_attempts: { label: msg("Attente de la facture avant l'email"), unit: msg("vérifications") },
  ticket_pdf_wait_delay_seconds: { label: msg("Délai entre deux vérifications"), unit: msg("secondes") },
  // Informations légales
  platform_legal_name: { label: msg("Raison sociale"), format: "text" },
  platform_siret: { label: "SIRET", format: "text" },
  platform_vat_number: { label: msg("Numéro de TVA intracommunautaire"), format: "text" },
  platform_address: { label: msg("Adresse du siège"), format: "text" },
  platform_iban: { label: msg("IBAN de la plateforme (émetteur des virements)"), format: "text" },
  platform_bic: { label: msg("BIC de la banque de la plateforme"), format: "text" },
};

/** Libellé lisible d'un réglage (repli : sa description serveur, puis sa clé). */
export function settingLabel(key: string, fallback?: string | null): string {
  return t(FIELDS[key]?.label ?? fallback ?? key);
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
