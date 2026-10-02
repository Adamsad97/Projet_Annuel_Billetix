import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobLockModule } from '../scheduler/job-lock.module';
import { TicketModule } from '../ticket/ticket.module';
import { ResaleCleanupService } from './resale-cleanup.service';
import { TicketResale } from './ticket-resale.entity';
import { TicketResaleController } from './ticket-resale.controller';
import { TicketResaleService } from './ticket-resale.service';

@Module({
  imports: [TypeOrmModule.forFeature([TicketResale]), TicketModule, JobLockModule],
  controllers: [TicketResaleController],
  providers: [TicketResaleService, ResaleCleanupService],
})
export class TicketResaleModule {}
