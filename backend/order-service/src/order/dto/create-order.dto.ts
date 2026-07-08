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

  @IsString() @IsOptional()
  ticket_category_name?: string;

  @IsInt() @Min(1)
  quantity: number;

  @IsNumber() @Min(0)
  unit_price_ht: number;

  @IsString() @IsOptional()
  holder_first_name?: string;

  @IsString() @IsOptional()
  holder_last_name?: string;

  @IsString() @IsOptional()
  seat_info?: string;
}

export class CreateOrderDto {
  @IsString()
  buyer_id: string;

  @IsString()
  event_id: string;

  // Token de réservation Redis (obligatoire — anti-race-condition F1)
  @IsString()
  reservation_token: string;

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

  // Snapshot événement (transmis depuis api-gateway)
  @IsString() @IsOptional()
  organizer_id?: string;

  @IsString() @IsOptional()
  event_name?: string;

  @IsString() @IsOptional()
  event_start_at?: string;

  @IsString() @IsOptional()
  event_end_at?: string;

  @IsString() @IsOptional()
  event_venue_name?: string;

  @IsString() @IsOptional()
  event_venue_address?: string;

  @IsString() @IsOptional()
  event_city?: string;

  @IsString() @IsOptional()
  event_poster_url?: string;

  @IsString() @IsOptional()
  artist_name?: string;

  @IsString() @IsOptional()
  artist_description?: string;

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

// La réservation de stock (étape 1, avant paiement) ne connaît que la
// catégorie et la quantité — le prix n'est fixé qu'à la création de la
// commande (CreateOrderDto). Un DTO dédié évite d'exiger à tort
// unit_price_ht ici (celui de OrderItemInputDto est requis, à raison,
// pour la création).
export class ReserveStockItemDto {
  @IsString()
  ticket_category_id: string;

  @IsInt() @Min(1)
  quantity: number;
}

export class ReserveStockDto {
  @IsString()
  buyer_id: string;

  @IsString()
  event_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveStockItemDto)
  items: ReserveStockItemDto[];
}
