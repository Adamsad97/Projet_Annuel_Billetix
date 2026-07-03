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

// Commissions
export const COMMISSION = {
  STANDARD_PERCENT: 10,
  LARGE_EVENT_PERCENT: 8,
  LARGE_EVENT_THRESHOLD: 1000,
  FREE_TICKET_FEE_EUR: 0.5,
} as const;

// Délais (en millisecondes)
export const DELAYS = {
  STOCK_RESERVATION_TTL_MS: 10 * 60 * 1000,  // 10 minutes
  EMAIL_RETRY_INTERVAL_MS: 10 * 60 * 1000,    // 10 minutes
  EMAIL_MAX_RETRIES: 3,
  PAYOUT_DAYS_AFTER_EVENT: 5,
  DISPUTE_MAX_DAYS: 30,
  OFFLINE_SYNC_MAX_HOURS: 4,
} as const;
