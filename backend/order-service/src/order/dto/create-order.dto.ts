import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../order.entity';

export class OrderItemInputDto {
  @IsUUID()
  ticket_category_id: string;

  @IsInt() @Min(1)
  quantity: number;

  // Nom et prix relus par OrderService depuis event-service, jamais acceptés du client.

  @IsString() @IsOptional()
  holder_first_name?: string;

  @IsString() @IsOptional()
  holder_last_name?: string;

  @IsString() @IsOptional()
  seat_info?: string;
}

export class CreateOrderDto {
  @IsUUID()
  buyer_id: string;

  @IsUUID()
  event_id: string;

  // Token de réservation Redis (obligatoire — anti-race-condition F1)
  @IsString()
  reservation_token: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  // Code promo saisi par l'acheteur, revalidé et recalculé par OrderService.
  @IsString() @IsOptional()
  promo_code?: string;

  // Pas de taux de commission ici : il est relu depuis l'événement (sinon porte de fraude).

  // Snapshot événement (transmis depuis api-gateway)
  @IsUUID() @IsOptional()
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

  // Adresse : obligatoire pour une commande payante — vérifié dans
  // OrderService.create une fois le total calculé côté serveur.
  @IsString() @IsOptional()
  billing_address_line1?: string;

  @IsString() @IsOptional()
  billing_address_line2?: string;

  @IsString() @IsOptional()
  billing_city?: string;

  @IsString() @IsOptional()
  billing_postal_code?: string;

  @IsString() @IsOptional()
  billing_country?: string;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;
}

// DTO de la réservation de stock, distinct d'OrderItemInputDto (cycles de vie différents).
export class ReserveStockItemDto {
  @IsUUID()
  ticket_category_id: string;

  @IsInt() @Min(1)
  quantity: number;
}

export class ReserveStockDto {
  @IsUUID()
  buyer_id: string;

  @IsUUID()
  event_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveStockItemDto)
  items: ReserveStockItemDto[];
}

// Achat en revente : ni réservation, ni prix ou commission fournis par le client.
export class CreateResaleOrderDto {
  @IsUUID()
  buyer_id: string;

  @IsUUID()
  resale_id: string;

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
