import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../order.entity';

export class OrderItemInputDto {
  @IsString()
  ticket_category_id: string;

  @IsInt() @Min(1)
  quantity: number;

  @IsNumber() @Min(0)
  unit_price_ht: number;
}

export class CreateOrderDto {
  @IsString()
  buyer_id: string;

  @IsString()
  event_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @IsString() @IsOptional()
  promo_code_id?: string;

  @IsNumber() @IsOptional()
  discount_amount?: number;

  @IsNumber()
  commission_rate: number;

  // Facturation
  @IsString()
  billing_first_name: string;

  @IsString()
  billing_last_name: string;

  @IsEmail()
  billing_email: string;

  @IsString()
  billing_address_line1: string;

  @IsString() @IsOptional()
  billing_address_line2?: string;

  @IsString()
  billing_city: string;

  @IsString()
  billing_postal_code: string;

  @IsString()
  billing_country: string;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;
}
