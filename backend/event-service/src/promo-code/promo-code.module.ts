import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoCode } from './promo-code.entity';
import { PromoCodeController } from './promo-code.controller';
import { PromoCodeService } from './promo-code.service';

@Module({
  imports: [TypeOrmModule.forFeature([PromoCode])],
  controllers: [PromoCodeController],
  providers: [PromoCodeService],
  exports: [PromoCodeService],
})
export class PromoCodeModule {}
