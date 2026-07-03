import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CategoryVisibility } from '../ticket-category.entity';

export class CreateTicketCategoryDto {
  @IsString()
  event_id: string;

  @IsString()
  name: string;

  @IsString() @IsOptional()
  description?: string;

  @IsNumber() @Min(0)
  price_ht: number;

  @IsInt() @Min(1)
  quota: number;

  @IsInt() @Min(1) @IsOptional()
  max_per_order?: number;

  @IsEnum(CategoryVisibility) @IsOptional()
  visibility?: CategoryVisibility;

  @IsDateString() @IsOptional()
  valid_from?: string;

  @IsDateString() @IsOptional()
  valid_until?: string;

  @IsDateString() @IsOptional()
  sales_start_date?: string;

  @IsDateString() @IsOptional()
  sales_end_date?: string;
}
