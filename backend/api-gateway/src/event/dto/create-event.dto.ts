import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

export enum EventCategory {
  CONCERT = "CONCERT",
  THEATRE = "THEATRE",
  DANSE = "DANSE",
  FESTIVAL = "FESTIVAL",
  CONFERENCE = "CONFERENCE",
  SPORT = "SPORT",
  AUTRE = "AUTRE",
}

export enum RefundPolicy {
  NON_REFUNDABLE = "NON_REFUNDABLE",
  REFUNDABLE = "REFUNDABLE",
}

export class CreateEventDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(120)
  title: string;

  @ApiProperty() @IsString() @MinLength(10)
  description: string;

  @ApiProperty({ enum: EventCategory }) @IsEnum(EventCategory)
  category: EventCategory;

  @ApiPropertyOptional() @IsBoolean() @IsOptional()
  is_non_profit?: boolean;

  @ApiPropertyOptional() @IsUrl() @IsOptional()
  non_profit_document_url?: string;

  @ApiProperty() @IsDateString()
  start_date: string;

  @ApiProperty() @IsDateString()
  end_date: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  timezone?: string;

  @ApiProperty() @IsString()
  venue_name: string;

  @ApiProperty() @IsString()
  venue_address_line1: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  venue_address_line2?: string;

  @ApiProperty() @IsString()
  venue_city: string;

  @ApiProperty() @IsString()
  venue_postal_code: string;

  @ApiProperty() @IsString()
  venue_country: string;

  @ApiPropertyOptional() @IsOptional()
  venue_latitude?: number;

  @ApiPropertyOptional() @IsOptional()
  venue_longitude?: number;

  @ApiProperty() @IsUrl()
  poster_url: string;

  @ApiProperty() @IsInt() @Min(1)
  total_capacity: number;

  @ApiProperty() @IsDateString()
  sales_start_date: string;

  @ApiProperty() @IsDateString()
  sales_end_date: string;

  @ApiProperty({ enum: RefundPolicy }) @IsEnum(RefundPolicy)
  refund_policy: RefundPolicy;

  @ApiPropertyOptional() @IsInt() @Min(1) @IsOptional()
  refund_deadline_days?: number;

  @ApiPropertyOptional() @IsString() @IsOptional()
  access_conditions?: string;
}
