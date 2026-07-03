import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EventCategory, RefundPolicy } from '../event.entity';

export class CreateEventDto {
  @IsString() @MinLength(5) @MaxLength(120)
  title: string;

  @IsString() @MinLength(10)
  description: string;

  @IsEnum(EventCategory)
  category: EventCategory;

  @IsBoolean() @IsOptional()
  is_non_profit?: boolean;

  @IsUrl() @IsOptional()
  non_profit_document_url?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsString() @IsOptional()
  timezone?: string;

  @IsString()
  venue_name: string;

  @IsString()
  venue_address_line1: string;

  @IsString() @IsOptional()
  venue_address_line2?: string;

  @IsString()
  venue_city: string;

  @IsString()
  venue_postal_code: string;

  @IsString()
  venue_country: string;

  @IsOptional()
  venue_latitude?: number;

  @IsOptional()
  venue_longitude?: number;

  @IsUrl()
  poster_url: string;

  @IsInt() @Min(1)
  total_capacity: number;

  @IsDateString()
  sales_start_date: string;

  @IsDateString()
  sales_end_date: string;

  @IsEnum(RefundPolicy)
  refund_policy: RefundPolicy;

  @IsInt() @Min(1) @IsOptional()
  refund_deadline_days?: number;

  @IsString() @IsOptional()
  access_conditions?: string;
}
