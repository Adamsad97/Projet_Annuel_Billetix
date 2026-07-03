import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketCategory } from './ticket-category.entity';
import { TicketCategoryController } from './ticket-category.controller';
import { TicketCategoryService } from './ticket-category.service';

@Module({
  imports: [TypeOrmModule.forFeature([TicketCategory])],
  controllers: [TicketCategoryController],
  providers: [TicketCategoryService],
  exports: [TicketCategoryService],
})
export class TicketCategoryModule {}
