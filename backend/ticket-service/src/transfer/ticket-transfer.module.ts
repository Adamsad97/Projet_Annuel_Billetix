import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketTransferController } from './ticket-transfer.controller';
import { TicketTransfer } from './ticket-transfer.entity';
import { TicketTransferService } from './ticket-transfer.service';
import { TransferRevertRequest } from './transfer-revert-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TicketTransfer, TransferRevertRequest])],
  controllers: [TicketTransferController],
  providers: [TicketTransferService],
})
export class TicketTransferModule {}
