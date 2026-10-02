import { JobLockModule } from './job-lock.module';
import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { OrderCleanupService } from './order-cleanup.service';

@Module({
  imports: [OrderModule, JobLockModule],
  providers: [OrderCleanupService],
})
export class OrderCleanupModule {}
