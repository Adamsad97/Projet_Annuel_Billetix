import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum SyncStatus {
  SYNCED = 'SYNCED',
  CONFLICT = 'CONFLICT',
  ERROR = 'ERROR',
}

@Entity({ name: 'offline_sync_logs', schema: 'tickets' })
export class OfflineSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  agent_id: string;

  @Column()
  event_id: string;

  @Column()
  ticket_id: string;

  @Column({ type: 'timestamptz' })
  scanned_at_offline: Date;

  @Column({ type: 'timestamptz' })
  synced_at: Date;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.SYNCED })
  status: SyncStatus;

  @Column({ type: 'text', nullable: true })
  conflict_detail: string | null;

  @CreateDateColumn()
  created_at: Date;
}
