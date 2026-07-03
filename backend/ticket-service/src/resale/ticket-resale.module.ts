import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketModule } from '../ticket/ticket.module';
import { TicketResale } from './ticket-resale.entity';
import { TicketResaleController } from './ticket-resale.controller';
import { TicketResaleService } from './ticket-resale.service';

@Module({
  imports: [TypeOrmModule.forFeature([TicketResale]), TicketModule],
  controllers: [TicketResaleController],
  providers: [TicketResaleService],
})
export class TicketResaleModule {}
