import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { JobLock } from './job-lock.service';

@Module({
  imports: [RedisModule],
  providers: [JobLock],
  exports: [JobLock],
})
export class JobLockModule {}
