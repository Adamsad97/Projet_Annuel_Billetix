import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class InvoicePdfItemDto {
  @IsString()
  ticket_category_name: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unit_price_ht: number;

  @IsNumber()
  @Min(0)
  unit_price_ttc: number;

  @IsNumber()
  @Min(0)
  total_price_ht: number;

  @IsNumber()
  @Min(0)
  total_price_ttc: number;
}

export class InvoicePdfDto {
  @IsUUID()
  order_id: string;

  @IsString()
  reference: string;

  @IsDateString()
  paid_at: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  tva_rate: number;

  @IsString()
  billing_first_name: string;

  @IsString()
  billing_last_name: string;

  @IsString()
  billing_address_line1: string;

  @IsString()
  @IsOptional()
  billing_address_line2?: string | null;

  @IsString()
  billing_city: string;

  @IsString()
  billing_postal_code: string;

  @IsString()
  billing_country: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoicePdfItemDto)
  items: InvoicePdfItemDto[];

  @IsNumber()
  @Min(0)
  total_amount_ht: number;

  @IsNumber()
  @Min(0)
  total_amount_ttc: number;

  @IsNumber()
  @Min(0)
  discount_amount: number;

  @IsNumber()
  @Min(0)
  free_ticket_fees: number;

  @IsString()
  platform_legal_name: string;

  @IsString()
  platform_siret: string;

  @IsString()
  platform_vat_number: string;

  @IsString()
  platform_address: string;
}
