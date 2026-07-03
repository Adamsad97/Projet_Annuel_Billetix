import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ScanResult {
  SUCCESS = 'SUCCESS',
  ALREADY_USED = 'ALREADY_USED',
  INVALID = 'INVALID',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'scan_logs', schema: 'tickets' })
export class ScanLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticket_id: string;

  @Column()
  agent_id: string;

  @Column()
  event_id: string;

  @Column({ type: 'timestamptz' })
  scanned_at: Date;

  @Column({ type: 'enum', enum: ScanResult })
  result: ScanResult;

  @Column({ nullable: true })
  device_info: string | null;

  @Column({ default: false })
  is_offline: boolean;

  @CreateDateColumn()
  created_at: Date;
}
