import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CancellationMessage } from './cancellation-message.entity';

/** Objet de la demande de l'organisateur. */
export enum ChangeRequestKind {
  CANCELLATION = 'CANCELLATION',
  POSTPONEMENT = 'POSTPONEMENT',
}

export enum CancellationRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

/** Demande d'annulation ou de report par l'organisateur, appliquée seulement après accord d'un admin. */
@Entity({ name: 'event_cancellation_requests', schema: 'events' })
@Index(['event_id', 'status'])
export class CancellationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event_id: string;

  @Column()
  organizer_id: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: ChangeRequestKind, default: ChangeRequestKind.CANCELLATION })
  kind: ChangeRequestKind;

  // Report : nouvelle date proposée, ou null si elle n'est pas encore connue.
  @Column({ type: 'timestamptz', nullable: true })
  new_start_date: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  new_end_date: Date | null;

  @Column({ type: 'enum', enum: CancellationRequestStatus, default: CancellationRequestStatus.PENDING })
  status: CancellationRequestStatus;

  @Column({ nullable: true })
  decided_at: Date | null;

  @Column({ nullable: true })
  decided_by: string | null;

  @OneToMany(() => CancellationMessage, (message) => message.request)
  messages: CancellationMessage[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
