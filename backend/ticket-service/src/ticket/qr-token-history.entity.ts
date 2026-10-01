import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** Correspondance jeton QR opaque → billet ; is_current=false signale un jeton remplacé. */
@Entity({ schema: 'tickets', name: 'qr_token_history' })
export class QrTokenHistory {
  @PrimaryColumn()
  token: string;

  @Index()
  @Column()
  ticket_id: string;

  @Column({ default: true })
  is_current: boolean;

  @CreateDateColumn()
  created_at: Date;
}
