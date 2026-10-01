import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VatRateController } from './vat-rate.controller';
import { VatRate } from './vat-rate.entity';
import { VatRateService } from './vat-rate.service';

@Module({
  imports: [TypeOrmModule.forFeature([VatRate])],
  controllers: [VatRateController],
  providers: [VatRateService],
  exports: [VatRateService],
})
export class VatRateModule {}
