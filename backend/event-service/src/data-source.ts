import { DataSource } from 'typeorm';
import { Event } from './event/event.entity';
import { PromoCode } from './promo-code/promo-code.entity';
import { TicketCategory } from './ticket-category/ticket-category.entity';
import { ValidationRequest } from './validation-request/validation-request.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'events',
  entities: [Event, TicketCategory, PromoCode, ValidationRequest],
  migrations: ['src/migrations/*.ts'],
});
