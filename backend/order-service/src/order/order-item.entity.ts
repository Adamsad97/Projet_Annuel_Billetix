import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'order_items', schema: 'orders' })
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  order_id: string;

  @Column()
  ticket_category_id: string;

  @Column({ nullable: true })
  ticket_category_name: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price_ht: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price_ttc: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price_ht: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price_ttc: number;

  // Porteur du billet (snapshot au moment de l'achat)
  @Column({ nullable: true })
  holder_first_name: string | null;

  @Column({ nullable: true })
  holder_last_name: string | null;

  @Column({ nullable: true })
  seat_info: string | null;

  @CreateDateColumn()
  created_at: Date;
}
