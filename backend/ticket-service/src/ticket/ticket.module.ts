import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { QrTokenHistory } from './qr-token-history.entity';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, QrTokenHistory])],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
