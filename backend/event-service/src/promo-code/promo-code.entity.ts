import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

@Entity({ name: 'promo_codes', schema: 'events' })
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event_id: string;

  @Column()
  code: string;

  @Column({ type: 'enum', enum: DiscountType })
  discount_type: DiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discount_value: number;

  @Column({ type: 'int', nullable: true })
  max_uses: number | null;

  @Column({ type: 'int', default: 0 })
  current_uses: number;

  @Column({ type: 'timestamptz' })
  valid_from: Date;

  @Column({ type: 'timestamptz' })
  valid_until: Date;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
