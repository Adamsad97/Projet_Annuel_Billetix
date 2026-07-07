import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
}

@Entity({ name: 'payouts', schema: 'payments' })
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizer_id: string;

  @Column()
  event_id: string;

  // Lien vers la commande d'origine — permet de retrouver le payout à
  // ajuster lors d'un remboursement (une commande = un payout, cf.
  // PayoutService.create() appelé une fois par commande confirmée).
  // Nullable : les ajustements négatifs créés après remboursement d'un
  // payout déjà versé référencent aussi la commande via ce même champ.
  @Column({ nullable: true })
  order_id: string | null;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  gross_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commission_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  payment_fees_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  net_amount: number;

  @Column({ nullable: true })
  stripe_transfer_id: string | null;

  @Column({ type: 'timestamptz' })
  scheduled_at: Date;

  @Column({ nullable: true })
  processed_at: Date | null;

  @Column({ nullable: true })
  blocked_at: Date | null;

  @Column({ type: 'text', nullable: true })
  blocked_reason: string | null;

  @Column({ nullable: true })
  blocked_by: string | null;

  @Column({ nullable: true })
  requested_early_at: Date | null;

  @Column({ nullable: true })
  early_request_approved_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
