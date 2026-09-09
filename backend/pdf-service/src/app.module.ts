import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformConfigModule } from './platform-config/platform-config.module';
import { TicketPdfModule } from './pdf/ticket-pdf.module';
import { InvoicePdfModule } from './pdf/invoice-pdf.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlatformConfigModule,
    TicketPdfModule,
    InvoicePdfModule,
    HealthModule,
  ],
})
export class AppModule {}
