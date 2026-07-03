import { UserRole, EventStatus, OrderStatus, TicketStatus, ScanResult } from '../constants';

// Payload JWT
export interface JwtPayload {
  sub: string;       // user ID
  email: string;
  roles: UserRole[];
  iat?: number;
  exp?: number;
}

// Payload d'un QR code (avant signature HMAC)
export interface QrPayload {
  ticketId: string;
  eventId: string;
  createdAt: number; // timestamp Unix
}

// Résultat d'un scan retourné à l'application mobile
export interface ScanResponse {
  result: ScanResult;
  ticketId?: string;
  buyerFirstName?: string;
  buyerLastNameInitial?: string;
  categoryName?: string;
  scannedAt?: Date;
}

// Événement RabbitMQ : commande confirmée
export interface OrderConfirmedEvent {
  orderId: string;
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  eventId: string;
  eventName: string;
  eventDate: Date;
  eventVenue: string;
  items: Array<{
    ticketCategoryId: string;
    categoryName: string;
    quantity: number;
    unitPriceHt: number;
  }>;
  totalTtc: number;
}

// Événement RabbitMQ : billet créé (vers pdf-service)
export interface TicketCreatedEvent {
  ticketId: string;
  orderId: string;
  eventId: string;
  eventName: string;
  eventDate: Date;
  eventVenue: string;
  categoryName: string;
  buyerName: string;
  qrToken: string;
  ticketNumber: string;
  posterUrl?: string;
}

// Événement RabbitMQ : PDF prêt (vers notification-service)
export interface TicketPdfReadyEvent {
  ticketId: string;
  buyerEmail: string;
  buyerName: string;
  eventName: string;
  eventDate: Date;
  pdfUrl: string;
}

// Réponse standard de l'API
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}
