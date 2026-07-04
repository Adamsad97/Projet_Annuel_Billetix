import { DataSource } from 'typeorm';
import { ControlAgent } from './control-agent/control-agent.entity';
import { OfflineSyncLog } from './offline-sync/offline-sync-log.entity';
import { TicketResale } from './resale/ticket-resale.entity';
import { ScanLog } from './scan/scan-log.entity';
import { Ticket } from './ticket/ticket.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'tickets',
  entities: [Ticket, ScanLog, OfflineSyncLog, ControlAgent, TicketResale],
  migrations: ['src/migrations/*.ts'],
});
