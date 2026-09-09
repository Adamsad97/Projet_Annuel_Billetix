import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

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
  update(@Payload() data: { id: string; dto: UpdateCategoryDto }) {
    return this.categoryService.update(data.id, data.dto);
  }

  @MessagePattern('event.category.delete')
  remove(@Payload() data: { id: string }) {
    return this.categoryService.remove(data.id);
  }
}
