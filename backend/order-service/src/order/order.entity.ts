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
  // Carte bancaire, Apple Pay ou Google Pay : tous passent par Stripe.
  STRIPE = 'STRIPE',
  // Commande à 0 € : réservation confirmée sans aucun prestataire de paiement.
  FREE = 'FREE',
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

  // Taux de TVA appliqué (fraction : 0.055 pour 5,5 %), celui de l'événement
  // au moment de l'achat : factures et avoirs le reprennent tel quel.
  @Column({ type: 'decimal', precision: 6, scale: 4, default: 0.2 })
  vat_rate: string;

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

  // Adresse de facturation : exigée pour une commande payante seulement
  // (une réservation gratuite ne demande que nom, prénom et email).
  @Column({ type: 'varchar', nullable: true })
  billing_address_line1: string | null;

  @Column({ nullable: true })
  billing_address_line2: string | null;

  @Column({ type: 'varchar', nullable: true })
  billing_city: string | null;

  @Column({ type: 'varchar', nullable: true })
  billing_postal_code: string | null;

  @Column({ type: 'varchar', nullable: true })
  billing_country: string | null;

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

  // Montant TTC déjà remboursé sans annuler la commande (ex. un billet
  // revendu : son vendeur récupère le prix de revente, les autres billets de
  // la commande restent valables). Déduit des chiffres d'affaires.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  refunded_amount: number;

  @Column({ nullable: true })
  invoice_url: string | null;

  // Bug corrigé : le rappel J-1 (ReminderService) n'avait aucune protection
  // contre un double envoi (redémarrage du service juste après le cron
  // quotidien, ré-exécution manuelle) — un acheteur aurait pu recevoir le
  // même rappel plusieurs fois.
  @Column({ default: false })
  reminder_sent: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  free_ticket_fees: number;

  // Achat sur le marché secondaire (revente) — pas de réservation de stock,
  // pas de commission/quota liés à une catégorie ; voir createFromResale().
  @Column({ default: false })
  is_resale: boolean;

  @Column({ nullable: true })
  resale_id: string | null;

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
