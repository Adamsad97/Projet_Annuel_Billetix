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

export enum CancellationRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

/**
 * Demande d'annulation d'un événement par son organisateur : l'annulation
 * (et le remboursement des acheteurs) n'a lieu qu'après accord d'un admin.
 * Tant qu'elle est en attente, les deux parties échangent des messages.
 */
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
