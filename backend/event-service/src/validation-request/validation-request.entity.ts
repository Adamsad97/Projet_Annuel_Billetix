import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'admin_validation_requests', schema: 'events' })
export class ValidationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  event_id: string;

  @Column()
  admin_id: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ nullable: true })
  responded_at: Date | null;

  @Column({ type: 'text', nullable: true })
  response: string | null;

  @CreateDateColumn()
  created_at: Date;
}
