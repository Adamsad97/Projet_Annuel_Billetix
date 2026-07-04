import { DataSource } from 'typeorm';
import { AuditLog } from './audit-log/audit-log.entity';
import { PlatformSetting } from './platform-config/platform-config.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'admin_logs',
  entities: [AuditLog, PlatformSetting],
  migrations: ['src/migrations/*.ts'],
});
