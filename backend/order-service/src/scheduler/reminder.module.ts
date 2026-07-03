import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/order.entity';
import { ReminderService } from './reminder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [ReminderService],
})
export class ReminderModule {}
