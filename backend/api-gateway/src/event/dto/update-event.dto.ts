import { ApiPropertyOptional } from "@nestjs/swagger";
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
} from "class-validator";
import { EventCategory, RefundPolicy } from "./create-event.dto";

// Tous les champs sont optionnels (mise à jour partielle) mais restent
// strictement typés — c'est ce typage qui permet au ValidationPipe global
// (whitelist:true) de filtrer toute clé étrangère au DTO (ex: status,
// commission_rate, validated_by) avant même d'atteindre event-service.
export class UpdateEventDto {
  @ApiPropertyOptional() @IsString() @MinLength(5) @MaxLength(120) @IsOptional()
  title?: string;

  @ApiPropertyOptional() @IsString() @MinLength(10) @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: EventCategory }) @IsEnum(EventCategory) @IsOptional()
  category?: EventCategory;

  @ApiPropertyOptional() @IsBoolean() @IsOptional()
  is_non_profit?: boolean;

  @ApiPropertyOptional() @IsUrl() @IsOptional()
  non_profit_document_url?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  start_date?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  end_date?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  timezone?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  venue_name?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  venue_address_line1?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  venue_address_line2?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  venue_city?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  venue_postal_code?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  venue_country?: string;

  @ApiPropertyOptional() @IsOptional()
  venue_latitude?: number;

  @ApiPropertyOptional() @IsOptional()
  venue_longitude?: number;

  @ApiPropertyOptional() @IsUrl() @IsOptional()
  poster_url?: string;

  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional()
  total_capacity?: number;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  sales_start_date?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  sales_end_date?: string;

  @ApiPropertyOptional({ enum: RefundPolicy }) @IsEnum(RefundPolicy) @IsOptional()
  refund_policy?: RefundPolicy;

  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional()
  refund_deadline_days?: number;

  @ApiPropertyOptional() @IsString() @IsOptional()
  access_conditions?: string;
}
