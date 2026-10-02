import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { RealtimeModule } from './realtime/realtime.module';
import { validateEnvironment } from './common/env.validation';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), RealtimeModule, HealthModule],
})
export class AppModule {}
