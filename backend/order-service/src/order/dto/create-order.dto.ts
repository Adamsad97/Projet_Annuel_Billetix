import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
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

  // Ni le nom ni le prix de la catégorie ne sont acceptés depuis le client :
  // OrderService les relit depuis event-service (TicketCategory.name/price_ht),
  // seule source de vérité — voir OrderService.create().

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

  // Le code promo saisi par l'acheteur (ex: "SUMMER10") — jamais son ID ni
  // une remise déjà calculée : OrderService le revalide et recalcule la
  // remise lui-même via event-service (mêmes principes que la commission).
  @IsString() @IsOptional()
  promo_code?: string;

  // Le taux de commission n'est JAMAIS accepté depuis le client : il est
  // relu depuis l'Event (event-service), qui le calcule déjà dynamiquement
  // depuis platform_settings (commission_standard_percent/large_event/etc.)
  // — voir OrderService.create(). Un champ ici serait une porte de fraude.

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

// DTO dédié à l'étape 1 (réservation de stock, avant paiement) — distinct
// de OrderItemInputDto même si leur forme se ressemble aujourd'hui, les deux
// étapes ayant des cycles de vie et des validations différents.
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

// Achat d'un billet en revente — pas de réservation de stock (le billet
// existe déjà, aucune place n'est décomptée), pas de prix/commission fournis
// par le client : tout est relu depuis l'offre de revente (ticket-service)
// et l'événement (event-service) — voir OrderService.createFromResale().
export class CreateResaleOrderDto {
  @IsString()
  buyer_id: string;

  @IsString()
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
