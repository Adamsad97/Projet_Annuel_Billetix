import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditAction {
  // Utilisateurs
  USER_SUSPENDED       = 'USER_SUSPENDED',
  USER_UNSUSPENDED     = 'USER_UNSUSPENDED',
  USER_DELETED         = 'USER_DELETED',
  USER_ROLE_CHANGED    = 'USER_ROLE_CHANGED',
  USER_ACCOUNT_UNLOCKED = 'USER_ACCOUNT_UNLOCKED',
  USER_ACCOUNT_ACTIVATED = 'USER_ACCOUNT_ACTIVATED',
  USER_2FA_RESET        = 'USER_2FA_RESET',
  USER_2FA_ENABLED      = 'USER_2FA_ENABLED',
  USER_2FA_DISABLED     = 'USER_2FA_DISABLED',
  USER_PASSWORD_RESET   = 'USER_PASSWORD_RESET',
  KYC_APPROVED         = 'KYC_APPROVED',
  KYC_REJECTED         = 'KYC_REJECTED',

  // Événements
  EVENT_APPROVED       = 'EVENT_APPROVED',
  EVENT_REJECTED       = 'EVENT_REJECTED',
  EVENT_SUSPENDED      = 'EVENT_SUSPENDED',
  EVENT_NON_PROFIT_VERIFIED = 'EVENT_NON_PROFIT_VERIFIED',
  EVENT_NON_PROFIT_REJECTED = 'EVENT_NON_PROFIT_REJECTED',
  EVENT_CANCELED       = 'EVENT_CANCELED',

  // Billets
  TICKET_INVALIDATED   = 'TICKET_INVALIDATED',
  // Accès du titulaire à son billet / sa facture (sécurité : traçabilité
  // en cas de contestation — qui, quand, depuis quelle IP et quel appareil).
  TICKET_QR_VIEWED       = 'TICKET_QR_VIEWED',
  TICKET_PDF_DOWNLOADED  = 'TICKET_PDF_DOWNLOADED',
  INVOICE_DOWNLOADED     = 'INVOICE_DOWNLOADED',
  // Billet offert à un autre compte (détail complet : tickets.ticket_transfers).
  TICKET_TRANSFERRED     = 'TICKET_TRANSFERRED',
  // Annulation d'un transfert : demandée par l'expéditeur, puis acceptée
  // (billet rendu) ou refusée par un admin.
  TICKET_TRANSFER_REVERT_REQUESTED = 'TICKET_TRANSFER_REVERT_REQUESTED',
  TICKET_TRANSFER_REVERTED         = 'TICKET_TRANSFER_REVERTED',
  TICKET_TRANSFER_REVERT_REJECTED  = 'TICKET_TRANSFER_REVERT_REJECTED',

  // Paiements & reversements
  PAYOUT_BLOCKED       = 'PAYOUT_BLOCKED',
  PAYOUT_UNBLOCKED     = 'PAYOUT_UNBLOCKED',
  PAYOUT_EARLY_APPROVED = 'PAYOUT_EARLY_APPROVED',
  PAYOUT_PROCESSED_MANUALLY = 'PAYOUT_PROCESSED_MANUALLY',
  REFUND_FORCED        = 'REFUND_FORCED',

  // Litiges
  DISPUTE_RESOLVED     = 'DISPUTE_RESOLVED',

  // Autre
  CUSTOM               = 'CUSTOM',
}

export enum AuditEntityType {
  USER    = 'USER',
  EVENT   = 'EVENT',
  ORDER   = 'ORDER',
  TICKET  = 'TICKET',
  PAYMENT = 'PAYMENT',
  PAYOUT  = 'PAYOUT',
  DISPUTE = 'DISPUTE',
}

@Entity({ name: 'audit_logs', schema: 'admin_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditAction, default: AuditAction.CUSTOM })
  action: AuditAction;

  @Column({ type: 'enum', enum: AuditEntityType })
  entity_type: AuditEntityType;

  @Column({ nullable: true })
  entity_id: string | null;

  @Column()
  performed_by: string;

  @Column({ nullable: true })
  performed_by_email: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ nullable: true })
  ip_address: string | null;

  @CreateDateColumn()
  created_at: Date;
}
