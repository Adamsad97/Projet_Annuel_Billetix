import { Module } from '@nestjs/common';
import { MinioModule } from '../storage/minio.module';
import { InvoicePdfController } from './invoice-pdf.controller';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  imports: [MinioModule],
  controllers: [InvoicePdfController],
  providers: [InvoicePdfService],
})
export class InvoicePdfModule {}
