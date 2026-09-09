import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Correspondance jeton QR opaque (valeur aléatoire pure, sans information
 * exploitable) -> billet. Le jeton ne prend son sens qu'à travers cette
 * table côté serveur — cf. TicketService.resolveTicketId()/verifyQr().
 * is_current=false signale un jeton remplacé (billet revendu depuis).
 */
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
