import { Module } from '@nestjs/common';
import { MinioModule } from '../storage/minio.module';
import { TicketPdfController } from './ticket-pdf.controller';
import { TicketPdfService } from './ticket-pdf.service';

@Module({
  imports: [MinioModule],
  controllers: [TicketPdfController],
  providers: [TicketPdfService],
})
export class TicketPdfModule {}
