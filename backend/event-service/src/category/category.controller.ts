import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { IdPayload } from '../common/payloads';
import { UpdateCategoryPayload } from '../common/module-payloads';

@Controller()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @MessagePattern('event.category.list')
  listActive() {
    return this.categoryService.listActive();
  }

  @MessagePattern('event.category.list_all')
  listAll() {
    return this.categoryService.listAll();
  }

  @MessagePattern('event.category.create')
  create(@Payload() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @MessagePattern('event.category.update')
  update(@Payload() data: UpdateCategoryPayload) {
    return this.categoryService.update(data.id, data.dto);
  }

  @MessagePattern('event.category.delete')
  remove(@Payload() data: IdPayload) {
    return this.categoryService.remove(data.id);
  }
}
