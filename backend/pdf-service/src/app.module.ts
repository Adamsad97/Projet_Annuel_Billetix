import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformConfigModule } from './platform-config/platform-config.module';
import { InvoicePdfModule } from './pdf/invoice-pdf.module';
import { HealthModule } from './health/health.module';
import { validateEnvironment } from './common/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PlatformConfigModule,
    InvoicePdfModule,
    HealthModule,
  ],
})
export class AppModule {}
