import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { QrDisplayCode } from './qr-display-code.entity';
import { QrDisplayCodeCleanupService } from './qr-display-code-cleanup.service';
import { QrTokenHistory } from './qr-token-history.entity';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, QrTokenHistory, QrDisplayCode])],
  controllers: [TicketController],
  providers: [TicketService, QrDisplayCodeCleanupService],
  exports: [TicketService],
})
export class TicketModule {}
