import { DataSource } from 'typeorm';
import { OrderItem } from './order/order-item.entity';
import { CreditNote } from './order/credit-note.entity';
import { Order } from './order/order.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'orders',
  entities: [Order, OrderItem, CreditNote],
  migrations: ['src/migrations/*.ts'],
});
