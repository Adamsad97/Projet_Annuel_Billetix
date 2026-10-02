import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobLockModule } from '../scheduler/job-lock.module';
import { Ticket } from './ticket.entity';
import { QrDisplayCode } from './qr-display-code.entity';
import { QrDisplayCodeCleanupService } from './qr-display-code-cleanup.service';
import { QrTokenHistory } from './qr-token-history.entity';
import { TicketController } from './ticket.controller';
import { QrSigner } from './qr-signer';
import { TicketService } from './ticket.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, QrTokenHistory, QrDisplayCode]), JobLockModule],
  controllers: [TicketController],
  providers: [TicketService, QrSigner, QrDisplayCodeCleanupService],
  exports: [TicketService],
})
export class TicketModule {}
