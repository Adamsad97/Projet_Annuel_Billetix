import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'order_items', schema: 'orders' })
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  order_id: string;

  @Column()
  ticket_category_id: string;

  @Column({ type: 'int' })
  quantity: number;

  // Snapshot des prix au moment de l'achat
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price_ht: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price_ttc: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price_ht: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price_ttc: number;

  @CreateDateColumn()
  created_at: Date;
}
