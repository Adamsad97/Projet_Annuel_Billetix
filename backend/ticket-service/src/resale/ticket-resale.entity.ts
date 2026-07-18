import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ResaleStatus {
  LISTED = 'LISTED',
  RESERVED = 'RESERVED', // un acheteur est en cours de paiement (verrou temporaire)
  SOLD = 'SOLD',
  EXPIRED = 'EXPIRED',    // événement passé sans acheteur
  WITHDRAWN = 'WITHDRAWN', // acheteur original retire l'offre
}

@Entity({ name: 'ticket_resales', schema: 'tickets' })
export class TicketResale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticket_id: string;

  @Column()
  original_order_id: string;

  @Column()
  original_buyer_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  resale_price: number;

  @Column({ type: 'enum', enum: ResaleStatus, default: ResaleStatus.LISTED })
  status: ResaleStatus;

  // Infos dénormalisées pour l'affichage sans appels supplémentaires
  @Column()
  event_id: string;

  @Column({ type: 'timestamptz' })
  event_start_at: Date;

  @Column()
  ticket_category_id: string;

  @Column()
  holder_first_name: string;

  @Column()
  holder_last_name: string;

  // Verrou temporaire pendant le paiement d'un acheteur (statut RESERVED)
  @Column({ nullable: true })
  reserved_by_buyer_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reservation_expires_at: Date | null;

  // Renseignés après la vente
  @Column({ nullable: true })
  new_buyer_id: string | null;

  @Column({ nullable: true })
  new_order_id: string | null;

  @Column({ nullable: true })
  sold_at: Date | null;

  @CreateDateColumn()
  listed_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
