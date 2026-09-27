import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CancellationRequest } from './cancellation-request.entity';

export enum CancellationMessageAuthor {
  ORGANIZER = 'ORGANIZER',
  ADMIN = 'ADMIN',
}

/** Message de l'échange entre l'organisateur et l'admin sur une demande d'annulation. */
@Entity({ name: 'event_cancellation_messages', schema: 'events' })
export class CancellationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  request_id: string;

  @ManyToOne(() => CancellationRequest, (request) => request.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: CancellationRequest;

  @Column()
  author_id: string;

  @Column({ type: 'enum', enum: CancellationMessageAuthor })
  author_role: CancellationMessageAuthor;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  created_at: Date;
}
