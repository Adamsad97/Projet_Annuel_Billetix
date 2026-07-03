import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuyerProfile } from './buyer-profile.entity';
import { BuyerController } from './buyer.controller';
import { BuyerService } from './buyer.service';

@Module({
  imports: [TypeOrmModule.forFeature([BuyerProfile])],
  controllers: [BuyerController],
  providers: [BuyerService],
  exports: [BuyerService],
})
export class BuyerModule {}
