// Rôles utilisateurs
export enum UserRole {
  BUYER = 'BUYER',
  ORGANIZER = 'ORGANIZER',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN',
}

// Statuts d'un événement
export enum EventStatus {
  DRAFT = 'DRAFT',
  PENDING_VALIDATION = 'PENDING_VALIDATION',
  PUBLISHED = 'PUBLISHED',
  SUSPENDED = 'SUSPENDED',
  FINISHED = 'FINISHED',
  ARCHIVED = 'ARCHIVED',
  REJECTED = 'REJECTED',
}

// Catégories d'événements
export enum EventCategory {
  CONCERT = 'CONCERT',
  THEATRE = 'THEATRE',
  DANSE = 'DANSE',
  FESTIVAL = 'FESTIVAL',
  CONFERENCE = 'CONFERENCE',
  SPORT = 'SPORT',
  AUTRE = 'AUTRE',
}

// Statuts d'une commande
export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  TICKETS_SENT = 'TICKETS_SENT',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

// Statuts d'un billet
export enum TicketStatus {
  VALID = 'VALID',
  USED = 'USED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

// Résultats d'un scan QR
export enum ScanResult {
  VALID = 'VALID',
  ALREADY_USED = 'ALREADY_USED',
  WRONG_EVENT = 'WRONG_EVENT',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  NOT_FOUND = 'NOT_FOUND',
}

// Statuts KYC
export enum KycStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Statuts de reversement
export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
}

// Visibilité d'une catégorie de billet
export enum TicketCategoryVisibility {
  PUBLIC = 'PUBLIC',
  PROMO_CODE = 'PROMO_CODE',
  HIDDEN = 'HIDDEN',
}

// Valeurs de fallback uniquement — toutes ces valeurs sont pilotées par
// admin-service (table platform_settings) et injectées via PlatformConfigCache.
// Ne pas les utiliser directement dans le code métier.
export const PLATFORM_CONFIG_FALLBACK = {
  tva_rate: 0.20,
  free_ticket_fee_eur: 0.50,
  commission_standard_percent: 10,
  commission_large_event_percent: 8,
  large_event_threshold: 1000,
  payout_delay_days: 5,
  stripe_fee_percent: 2.9,
  stripe_fee_fixed_eur: 0.30,
  stock_reservation_ttl_seconds: 600,
  cancel_deadline_hours: 24,
  agent_session_hours: 12,
  fill_thresholds: [25, 50, 75, 100],
} as const;
