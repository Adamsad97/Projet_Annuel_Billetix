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

  /** Dernier scan de l'agent pour cet événement. */
  @Column({ nullable: true })
  last_activity_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
