import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  TICKETS_SENT = 'TICKETS_SENT',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  APPLE_PAY = 'APPLE_PAY',
  GOOGLE_PAY = 'GOOGLE_PAY',
  ORANGE_MONEY = 'ORANGE_MONEY',
  WAVE = 'WAVE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity({ name: 'orders', schema: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string;

  @Column()
  buyer_id: string;

  @Column()
  event_id: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount_ht: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount_ttc: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_commission: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_payment_fees: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  net_organizer_amount: number;

  @Column({ nullable: true })
  promo_code_id: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  // Snapshot facturation au moment de l'achat
  @Column()
  billing_first_name: string;

  @Column()
  billing_last_name: string;

  @Column()
  billing_email: string;

  @Column()
  billing_address_line1: string;

  @Column({ nullable: true })
  billing_address_line2: string | null;

  @Column()
  billing_city: string;

  @Column()
  billing_postal_code: string;

  @Column()
  billing_country: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  payment_method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  payment_status: PaymentStatus;

  @Column({ nullable: true })
  payment_intent_id: string | null;

  @Column({ nullable: true })
  paid_at: Date | null;

  @Column({ nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @Column({ nullable: true })
  refunded_at: Date | null;

  @Column({ nullable: true })
  invoice_url: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  free_ticket_fees: number;

  // Snapshot événement (nécessaire pour ticket-service après paiement)
  @Column({ nullable: true })
  organizer_id: string | null;

  @Column({ nullable: true })
  event_name: string | null;

  @Column({ nullable: true })
  event_start_at: Date | null;

  @Column({ nullable: true })
  event_end_at: Date | null;

  @Column({ nullable: true })
  event_venue_name: string | null;

  @Column({ nullable: true })
  event_venue_address: string | null;

  @Column({ nullable: true })
  event_city: string | null;

  @Column({ nullable: true })
  event_poster_url: string | null;

  @Column({ nullable: true })
  artist_name: string | null;

  @Column({ nullable: true })
  artist_description: string | null;

  // Snapshot acheteur
  @Column({ nullable: true })
  buyer_email: string | null;

  @Column({ nullable: true })
  buyer_first_name: string | null;

  @Column({ nullable: true })
  buyer_last_name: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
