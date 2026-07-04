import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'platform_settings', schema: 'admin_logs' })
export class PlatformSetting {
  @PrimaryColumn({ length: 64 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', length: 16, default: 'number' })
  type: 'number' | 'string' | 'boolean' | 'json';

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}
