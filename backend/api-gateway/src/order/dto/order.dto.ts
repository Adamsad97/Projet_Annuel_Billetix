import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export const PAYMENT_METHODS = ["STRIPE", "PAYPAL", "APPLE_PAY", "GOOGLE_PAY", "ORANGE_MONEY", "WAVE", "FREE"] as const;
// Plafond technique d'une ligne de commande ; le maximum métier par commande
// est celui de la catégorie de billet (max_per_order), vérifié par event-service.
const MAX_QUANTITY_PER_LINE = 100;

export class ReserveItemDto {
  @ApiProperty() @IsUUID("all", { message: "Catégorie de billet invalide." }) ticket_category_id: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_LINE)
  quantity: number;
}

/** Étape 1 : réservation du stock. */
export class ReserveStockDto {
  @ApiProperty() @IsUUID("all", { message: "Identifiant d'événement invalide." }) event_id: string;

  @ApiProperty({ type: [ReserveItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: "Sélectionnez au moins un billet." })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ReserveItemDto)
  items: ReserveItemDto[];
}

export class OrderItemDto extends ReserveItemDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100) holder_first_name?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100) holder_last_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) seat_info?: string;
}

/** Identité de l'acheteur et moyen de paiement. */
class BuyerIdentityDto {
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty({ message: "Le prénom est obligatoire." }) @MaxLength(100)
  billing_first_name: string;

  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty({ message: "Le nom est obligatoire." }) @MaxLength(100)
  billing_last_name: string;

  @ApiProperty() @Transform(trim) @IsEmail({}, { message: "L'adresse email n'est pas valide." }) @MaxLength(254)
  billing_email: string;

  // FREE : réservation gratuite — accepté seulement si le total calculé
  // par order-service est nul (jamais sur la parole du client).
  @ApiProperty({ enum: PAYMENT_METHODS }) @IsIn(PAYMENT_METHODS, { message: "Moyen de paiement non pris en charge." })
  payment_method: (typeof PAYMENT_METHODS)[number];
}

/** Coordonnées de facturation complètes (achat en revente, toujours payant). */
export class BillingDto extends BuyerIdentityDto {
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty({ message: "L'adresse est obligatoire." }) @MaxLength(200)
  billing_address_line1: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(200) billing_address_line2?: string;

  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty({ message: "La ville est obligatoire." }) @MaxLength(100)
  billing_city: string;

  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty({ message: "Le code postal est obligatoire." }) @MaxLength(20)
  billing_postal_code: string;

  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty({ message: "Le pays est obligatoire." }) @MaxLength(60)
  billing_country: string;
}

/**
 * Étape 2 : création de la commande. Prix, commission et informations de
 * l'événement ne sont jamais acceptés du client : ils sont relus côté serveur.
 */
export class CreateOrderDto extends BuyerIdentityDto {
  // Adresse facultative ici : exigée par order-service pour une commande
  // payante, inutile pour une réservation gratuite.
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(200) billing_address_line1?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(200) billing_address_line2?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100) billing_city?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(20) billing_postal_code?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(60) billing_country?: string;

  @ApiProperty() @IsUUID("all", { message: "Identifiant d'événement invalide." }) event_id: string;

  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) reservation_token: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: "Sélectionnez au moins un billet." })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(30) promo_code?: string;
}
