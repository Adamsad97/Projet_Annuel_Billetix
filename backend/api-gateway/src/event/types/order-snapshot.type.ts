export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  TICKETS_SENT = 'TICKETS_SENT',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export interface Order {
  id: string;
  buyer_id: string;
  buyer_email: string;
  buyer_first_name: string;
  buyer_last_name: string;
  total_amount_ttc: number;
  status: OrderStatus;
  event_id: string;
  event_name: string;
  event_start_at: string;
  event_venue_name: string;
}
