/** Réglages rangés par section ; les sections sensibles (argent, sécurité, légal) sont réservées au super admin. */
export interface SettingSection {
  id: string;
  super_admin_only: boolean;
  keys: string[];
}

export const SETTING_SECTIONS: SettingSection[] = [
  {
    id: 'security',
    super_admin_only: true,
    keys: [
      'password_min_length',
      'password_max_age_days',
      'magic_link_ttl_minutes',
      'minimum_signup_age',
      'account_lockout_threshold',
      'account_lockout_duration_minutes',
      'session_idle_timeout_minutes',
      'session_max_duration_hours',
      'session_refresh_grace_seconds',
      'sensitive_action_reauth_minutes',
    ],
  },
  {
    id: 'tickets',
    super_admin_only: false,
    keys: [
      'ticket_qr_rotation_seconds',
      'ticket_qr_rotation_tolerance_steps',
      'scan_opens_before_minutes',
      'scan_closes_after_minutes',
      'ticket_qr_display_seconds',
      'ticket_transfer_max_per_ticket',
      'ticket_transfer_cutoff_hours',
      'resale_reservation_minutes',
      'agent_invitation_hours',
    ],
  },
  {
    id: 'events',
    super_admin_only: false,
    keys: ['event_validation_deadline_hours', 'event_archive_delay_days', 'cancel_deadline_hours', 'postponement_refund_days', 'fill_thresholds'],
  },
  {
    id: 'orders',
    super_admin_only: false,
    keys: ['stock_reservation_ttl_seconds', 'order_abandon_timeout_minutes'],
  },
  {
    id: 'fees',
    super_admin_only: true,
    keys: [
      'commission_standard_percent',
      'commission_large_event_percent',
      'large_event_threshold',
      'free_ticket_fee_eur',
    ],
  },
  {
    id: 'payment_fees',
    super_admin_only: true,
    keys: [
      'stripe_fee_percent',
      'stripe_fee_fixed_eur',
    ],
  },
  {
    id: 'payouts',
    super_admin_only: true,
    keys: [
      'payout_delay_days',
      'iban_change_payout_hold_hours',
      'payout_early_request_min_days_after_event',
      'dispute_alert_threshold',
      'dispute_payout_block_max_days',
      'refund_alert_threshold_24h',
    ],
  },
  {
    id: 'notifications',
    super_admin_only: false,
    keys: [
      'email_max_retry_attempts',
      'email_retry_delay_minutes',
      'pdf_generation_max_retry_attempts',
      'ticket_pdf_wait_max_attempts',
      'ticket_pdf_wait_delay_seconds',
    ],
  },
  {
    id: 'legal',
    super_admin_only: true,
    keys: ['platform_legal_name', 'platform_siret', 'platform_vat_number', 'platform_address', 'platform_iban', 'platform_bic'],
  },
];

const SECTION_BY_KEY = new Map(
  SETTING_SECTIONS.flatMap((section) => section.keys.map((key) => [key, section] as const)),
);

export function sectionOf(key: string): { id: string; super_admin_only: boolean } {
  const section = SECTION_BY_KEY.get(key);
  return section ? { id: section.id, super_admin_only: section.super_admin_only } : { id: 'other', super_admin_only: false };
}

/** Bornes métier des réglages numériques (au-delà du simple « c'est un nombre »). */
export function numericBoundsError(key: string, value: number): string | null {
  if (value < 0) return 'la valeur ne peut pas être négative';
  if (key.endsWith('_percent') && value > 100) return 'pourcentage attendu entre 0 et 100';
  if (key === 'magic_link_ttl_minutes' && value > 60) return 'un lien de connexion ne doit pas rester valable plus de 60 minutes';
  return null;
}
