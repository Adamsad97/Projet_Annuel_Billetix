import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketModule } from '../ticket/ticket.module';
import { ScanLog } from './scan-log.entity';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';

@Module({
  imports: [TypeOrmModule.forFeature([ScanLog]), TicketModule],
  controllers: [ScanController],
  providers: [ScanService],
  exports: [ScanService],
})
export class ScanModule {}
