import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class InvoicePdfItemDto {
  @IsString()
  ticket_category_name: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unit_price_ht: number;

  @IsNumber()
  unit_price_ttc: number;

  @IsNumber()
  total_price_ht: number;

  @IsNumber()
  total_price_ttc: number;
}

export class InvoicePdfDto {
  @IsString()
  order_id: string;

  @IsString()
  reference: string;

  @IsString()
  paid_at: string;

  @IsNumber()
  tva_rate: number;

  @IsString()
  billing_first_name: string;

  @IsString()
  billing_last_name: string;

  @IsEmail()
  billing_email: string;

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
  @ValidateNested({ each: true })
  @Type(() => InvoicePdfItemDto)
  items: InvoicePdfItemDto[];

  @IsNumber()
  total_amount_ht: number;

  @IsNumber()
  total_amount_ttc: number;

  @IsNumber()
  discount_amount: number;

  @IsNumber()
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
