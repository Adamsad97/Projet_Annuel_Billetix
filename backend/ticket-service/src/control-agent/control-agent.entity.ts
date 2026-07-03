import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'control_agents', schema: 'tickets' })
export class ControlAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  event_id: string;

  @Column()
  assigned_by: string;

  @Column({ default: false })
  is_supervisor: boolean;

  @Column({ nullable: true })
  session_token: string | null;

  @Column({ nullable: true })
  session_started_at: Date | null;

  @Column({ nullable: true })
  session_expires_at: Date | null;

  @Column({ nullable: true })
  last_activity_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
