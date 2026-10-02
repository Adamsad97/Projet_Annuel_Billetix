import { DataSource } from 'typeorm';
import { ControlAgent } from './control-agent/control-agent.entity';
import { OfflineSyncLog } from './offline-sync/offline-sync-log.entity';
import { TicketResale } from './resale/ticket-resale.entity';
import { ScanLog } from './scan/scan-log.entity';
import { QrDisplayCode } from './ticket/qr-display-code.entity';
import { QrTokenHistory } from './ticket/qr-token-history.entity';
import { Ticket } from './ticket/ticket.entity';
import { TicketTransfer } from './transfer/ticket-transfer.entity';
import { TransferRevertRequest } from './transfer/transfer-revert-request.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'tickets',
  entities: [Ticket, QrTokenHistory, ScanLog, OfflineSyncLog, ControlAgent, TicketResale, QrDisplayCode, TicketTransfer, TransferRevertRequest],
  migrations: ['src/migrations/*.ts'],
});
