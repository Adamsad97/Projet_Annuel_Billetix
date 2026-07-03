import { Module } from '@nestjs/common';
import { TicketsGateway } from './tickets.gateway';

@Module({
  providers: [TicketsGateway],
  exports: [TicketsGateway],
})
export class EventsModule {}
