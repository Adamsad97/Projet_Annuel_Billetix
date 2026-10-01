import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum RevertRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Demande d'annulation d'un transfert par l'expéditeur, traitée par un admin ; le téléphone passe par l'admin directement. */
@Entity({ schema: 'tickets', name: 'transfer_revert_requests' })
export class TransferRevertRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  transfer_id: string;

  @Column()
  ticket_id: string;

  @Index()
  @Column()
  requested_by: string;

  @Column({ type: 'text' })
  reason: string;

  @Index()
  @Column({ type: 'enum', enum: RevertRequestStatus, default: RevertRequestStatus.PENDING })
  status: RevertRequestStatus;

  @Column({ type: 'varchar', nullable: true })
  decided_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  decided_by_email: string | null;

  @Column({ type: 'text', nullable: true })
  decision_reason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decided_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
