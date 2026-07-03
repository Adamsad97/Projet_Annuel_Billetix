import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { TicketController } from './ticket.controller';

@Module({
  imports: [EventsModule],
  controllers: [TicketController],
})
export class TicketModule {}
