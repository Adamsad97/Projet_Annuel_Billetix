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
  // Organisateur payé par virement bancaire : montant arrêté (compensation
  // faite), en attente du virement SEPA émis par un admin.
  TO_TRANSFER = 'TO_TRANSFER',
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

  // Fin de l'événement, pour la demande anticipée après J+2 (CDC §7.2) ; null pour les ajustements négatifs.
  @Column({ type: 'timestamptz', nullable: true })
  event_end_at: Date | null;

  // Commande d'origine, pour retrouver le reversement à ajuster lors d'un remboursement.
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

  // Frais des billets gratuits à la charge de l'organisateur ; un net négatif est repris sur les reversements suivants.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  free_ticket_fees_amount: number;

  // Montants dus par l'organisateur (frais, remboursements après versement)
  // déduits de ce reversement : virement effectif = net_amount - offset_amount.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  offset_amount: number;

  // Montant dû soldé par compensation : reversement qui l'a absorbé.
  @Column({ type: 'varchar', nullable: true })
  settled_by_payout_id: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  net_amount: number;

  @Column({ nullable: true })
  stripe_transfer_id: string | null;

  // Virement bancaire : référence saisie par l'admin et auteur de la
  // confirmation (null pour un versement Stripe).
  @Column({ type: 'varchar', length: 140, nullable: true })
  bank_transfer_reference: string | null;

  @Column({ type: 'varchar', nullable: true })
  transferred_by: string | null;

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

  // Événement reporté, nouvelle date à venir : rien n'est versé (ni à
  // échéance, ni par anticipation) avant que la nouvelle date soit fixée.
  @Column({ default: false })
  on_hold_for_postponement: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
