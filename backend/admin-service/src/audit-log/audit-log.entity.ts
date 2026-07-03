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

  // Événements
  EVENT_APPROVED       = 'EVENT_APPROVED',
  EVENT_REJECTED       = 'EVENT_REJECTED',
  EVENT_SUSPENDED      = 'EVENT_SUSPENDED',
  EVENT_CANCELED       = 'EVENT_CANCELED',

  // Billets
  TICKET_INVALIDATED   = 'TICKET_INVALIDATED',

  // Paiements & reversements
  PAYOUT_BLOCKED       = 'PAYOUT_BLOCKED',
  PAYOUT_EARLY_APPROVED = 'PAYOUT_EARLY_APPROVED',
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
