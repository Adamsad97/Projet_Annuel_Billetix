import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { StockReservationService } from './stock-reservation.service';

@Module({
  imports: [RedisModule],
  providers: [StockReservationService],
  exports: [StockReservationService],
})
export class StockReservationModule {}
