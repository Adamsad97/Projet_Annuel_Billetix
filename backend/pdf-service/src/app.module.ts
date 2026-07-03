import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TicketPdfModule } from './pdf/ticket-pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TicketPdfModule,
  ],
})
export class AppModule {}
