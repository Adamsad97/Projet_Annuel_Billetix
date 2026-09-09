import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketCategory } from '../ticket-category/ticket-category.entity';
import { TicketTierType } from './ticket-tier-type.entity';
import { TicketTierTypeController } from './ticket-tier-type.controller';
import { TicketTierTypeService } from './ticket-tier-type.service';

@Module({
  imports: [TypeOrmModule.forFeature([TicketTierType, TicketCategory])],
  controllers: [TicketTierTypeController],
  providers: [TicketTierTypeService],
  exports: [TicketTierTypeService],
})
export class TicketTierTypeModule {}
