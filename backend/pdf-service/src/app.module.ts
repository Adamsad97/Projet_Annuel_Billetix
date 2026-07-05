import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TicketPdfModule } from './pdf/ticket-pdf.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TicketPdfModule,
    HealthModule,
  ],
})
export class AppModule {}
