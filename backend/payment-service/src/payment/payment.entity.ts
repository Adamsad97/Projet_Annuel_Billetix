import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  ORANGE_MONEY = 'ORANGE_MONEY',
  WAVE = 'WAVE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
}

@Entity({ name: 'payments', schema: 'payments' })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  order_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'eur' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentProvider, default: PaymentProvider.STRIPE })
  provider: PaymentProvider;

  @Column({ nullable: true })
  provider_payment_id: string | null;

  @Column({ nullable: true })
  provider_client_secret: string | null;

  // URL de redirection hébergée par le prestataire (PayPal/Orange Money/Wave)
  // vers laquelle l'acheteur doit être envoyé pour approuver le paiement —
  // sans objet pour Stripe (client_secret + confirmation JS côté frontend).
  @Column({ type: 'text', nullable: true })
  provider_redirect_url: string | null;

  // Jeton de vérification propre à Orange Money, à comparer à celui reçu
  // dans le callback de notification pour authentifier l'appel (l'API
  // Orange Money ne fournit pas de signature HMAC classique comme Stripe/Wave).
  @Column({ nullable: true })
  provider_notif_token: string | null;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @Column({ nullable: true })
  refunded_at: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  refunded_amount: number | null;

  @CreateDateColumn()
  created_at: Date;
}
