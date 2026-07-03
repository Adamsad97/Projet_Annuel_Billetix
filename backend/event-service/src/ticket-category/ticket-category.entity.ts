import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CategoryVisibility {
  PUBLIC = 'PUBLIC',
  PROMO_CODE = 'PROMO_CODE',
  HIDDEN = 'HIDDEN',
}

@Entity({ name: 'ticket_categories', schema: 'events' })
export class TicketCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event_id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_ht: number;

  @Column({ type: 'int' })
  quota: number;

  @Column({ type: 'int' })
  remaining_quota: number;

  @Column({ type: 'int', default: 10 })
  max_per_order: number;

  @Column({ type: 'enum', enum: CategoryVisibility, default: CategoryVisibility.PUBLIC })
  visibility: CategoryVisibility;

  @Column({ nullable: true })
  valid_from: Date | null;

  @Column({ nullable: true })
  valid_until: Date | null;

  @Column({ nullable: true })
  sales_start_date: Date | null;

  @Column({ nullable: true })
  sales_end_date: Date | null;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
