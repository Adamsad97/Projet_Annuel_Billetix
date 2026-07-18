import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { OrderCleanupService } from './order-cleanup.service';

@Module({
  imports: [OrderModule],
  providers: [OrderCleanupService],
})
export class OrderCleanupModule {}
