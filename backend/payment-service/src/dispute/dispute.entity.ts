import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  WON = 'WON',
  LOST = 'LOST',
  CLOSED = 'CLOSED',
}

export enum DisputeReason {
  FRAUDULENT = 'FRAUDULENT',
  DUPLICATE = 'DUPLICATE',
  PRODUCT_NOT_RECEIVED = 'PRODUCT_NOT_RECEIVED',
  PRODUCT_UNACCEPTABLE = 'PRODUCT_UNACCEPTABLE',
  SUBSCRIPTION_CANCELED = 'SUBSCRIPTION_CANCELED',
  GENERAL = 'GENERAL',
}

@Entity({ name: 'disputes', schema: 'payments' })
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  payment_id: string;

  @Column()
  order_id: string;

  @Column()
  buyer_id: string;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ type: 'enum', enum: DisputeReason, default: DisputeReason.GENERAL })
  reason: DisputeReason;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  stripe_dispute_id: string | null;

  @Column({ nullable: true })
  resolved_at: Date | null;

  @Column({ nullable: true })
  resolved_by: string | null;

  @Column({ type: 'text', nullable: true })
  resolution_notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
