import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // À venir : TypeOrmModule, DashboardModule, ModerationModule, FinanceModule
  ],
})
export class AppModule {}
