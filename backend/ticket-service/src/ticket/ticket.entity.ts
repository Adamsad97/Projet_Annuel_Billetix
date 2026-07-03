import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TicketStatus {
  GENERATED = 'GENERATED',
  SENT = 'SENT',
  FOR_RESALE = 'FOR_RESALE',
  USED = 'USED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

@Entity({ name: 'tickets', schema: 'tickets' })
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string;

  @Column()
  order_id: string;

  @Column()
  order_item_id: string;

  // ─── Infos événement (dénormalisées) ────────────────────────────────────────

  @Column()
  event_id: string;

  @Column()
  event_name: string;

  @Column({ type: 'timestamptz' })
  event_start_at: Date;

  @Column({ nullable: true })
  event_end_at: Date | null;

  @Column()
  event_venue_name: string;

  @Column()
  event_venue_address: string;

  @Column()
  event_city: string;

  @Column({ type: 'text', nullable: true })
  event_poster_url: string | null;

  // ─── Infos artiste / spectacle ───────────────────────────────────────────────

  @Column()
  artist_name: string;

  @Column({ type: 'text', nullable: true })
  artist_description: string | null;

  // ─── Infos catégorie ─────────────────────────────────────────────────────────

  @Column()
  ticket_category_id: string;

  @Column()
  ticket_category_name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price_ttc: number;

  @Column({ nullable: true })
  seat_info: string | null;

  // ─── Infos acheteur & porteur ────────────────────────────────────────────────

  @Column()
  buyer_id: string;

  @Column()
  buyer_email: string;

  @Column()
  holder_first_name: string;

  @Column()
  holder_last_name: string;

  // ─── QR code ──────────────────────────────────────────────────────────────────

  // Token unique signé HMAC-SHA256 — embarqué dans le QR code
  @Column({ unique: true })
  qr_code_token: string;

  @Column({ type: 'text', nullable: true })
  qr_code_url: string | null;

  @Column({ nullable: true })
  pdf_url: string | null;

  // ─── Statut & scan ────────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.GENERATED })
  status: TicketStatus;

  @Column({ nullable: true })
  scanned_at: Date | null;

  @Column({ nullable: true })
  scanned_by: string | null;

  @Column({ nullable: true })
  scan_device_info: string | null;

  @Column({ nullable: true })
  invalidated_at: Date | null;

  @Column({ nullable: true })
  invalidated_by: string | null;

  @Column({ type: 'text', nullable: true })
  invalidation_reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
