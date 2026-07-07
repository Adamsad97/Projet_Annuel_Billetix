import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationRequest } from './validation-request.entity';
import { ValidationRequestController } from './validation-request.controller';
import { ValidationRequestService } from './validation-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([ValidationRequest])],
  controllers: [ValidationRequestController],
  providers: [ValidationRequestService],
  exports: [ValidationRequestService],
})
export class ValidationRequestModule {}
