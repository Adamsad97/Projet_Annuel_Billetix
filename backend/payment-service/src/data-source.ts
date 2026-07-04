import { DataSource } from 'typeorm';
import { Dispute } from './dispute/dispute.entity';
import { Payment } from './payment/payment.entity';
import { Payout } from './payout/payout.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'payments',
  entities: [Payment, Payout, Dispute],
  migrations: ['src/migrations/*.ts'],
});
