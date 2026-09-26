import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum TicketTransferStatus {
  ACTIVE = 'ACTIVE',
  // Annulé par un admin : billet rendu à l'expéditeur.
  REVERTED = 'REVERTED',
}

/** Origine de la demande d'annulation. */
export enum TransferRevertSource {
  PHONE = 'PHONE',
  PLATFORM = 'PLATFORM',
}

/**
 * Transfert gratuit d'un billet (« offrir mon billet ») — une ligne par
 * transfert, jamais modifiée ni supprimée : c'est la trace commune à
 * l'expéditeur, au bénéficiaire et à l'administration. Les infos du billet
 * sont figées au moment du transfert : l'expéditeur garde un historique
 * lisible sans plus avoir accès au billet lui-même.
 */
@Entity({ schema: 'tickets', name: 'ticket_transfers' })
export class TicketTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  ticket_id: string;

  @Column()
  ticket_reference: string;

  @Index()
  @Column()
  event_id: string;

  @Column()
  event_name: string;

  @Column({ type: 'timestamptz' })
  event_start_at: Date;

  @Column()
  ticket_category_name: string;

  // ─── Expéditeur (titulaire avant le transfert) ───────────────────────────
  @Index()
  @Column()
  from_user_id: string;

  @Column()
  from_email: string;

  // Nom du compte expéditeur (affiché au bénéficiaire : « reçu de … »).
  @Column()
  from_first_name: string;

  @Column()
  from_last_name: string;

  @Column()
  from_holder_first_name: string;

  @Column()
  from_holder_last_name: string;

  // ─── Bénéficiaire (compte) et personne qui assistera à l'événement ───────
  @Index()
  @Column()
  to_user_id: string;

  @Column()
  to_email: string;

  @Column()
  to_holder_first_name: string;

  @Column()
  to_holder_last_name: string;

  // ─── Contexte de la demande (audit) ──────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // ─── Annulation (par un admin, à la demande de l'expéditeur) ─────────────
  @Column({ type: 'enum', enum: TicketTransferStatus, default: TicketTransferStatus.ACTIVE })
  status: TicketTransferStatus;

  @Column({ type: 'timestamptz', nullable: true })
  reverted_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reverted_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  reverted_by_email: string | null;

  @Column({ type: 'text', nullable: true })
  revert_reason: string | null;

  @Column({ type: 'enum', enum: TransferRevertSource, nullable: true })
  revert_source: TransferRevertSource | null;
}
