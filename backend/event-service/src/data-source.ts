import { DataSource } from 'typeorm';
import { Category } from './category/category.entity';
import { VatRate } from './vat-rate/vat-rate.entity';
import { Event } from './event/event.entity';
import { PromoCode } from './promo-code/promo-code.entity';
import { TicketCategory } from './ticket-category/ticket-category.entity';
import { TicketTierType } from './ticket-tier-type/ticket-tier-type.entity';
import { ValidationRequest } from './validation-request/validation-request.entity';
import { CancellationRequest } from './event/cancellation/cancellation-request.entity';
import { CancellationMessage } from './event/cancellation/cancellation-message.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'events',
  entities: [Event, Category, VatRate, TicketCategory, TicketTierType, PromoCode, ValidationRequest, CancellationRequest, CancellationMessage],
  migrations: ['src/migrations/*.ts'],
});
