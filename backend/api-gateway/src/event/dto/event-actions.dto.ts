import { PartialType } from "@nestjs/swagger";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { TEXT_MAX_LENGTH } from "../../common/dto/common.dto";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export enum TicketCategoryVisibility {
  PUBLIC = "PUBLIC",
  PROMO_CODE = "PROMO_CODE",
  HIDDEN = "HIDDEN",
}

/** Catégorie de billet ajoutée à un événement (l'événement vient de l'URL). */
export class CreateTicketCategoryDto {
  @ApiProperty({ example: "Standard" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Le type de billet est obligatoire." })
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  description?: string;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price_ht: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quota: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_per_order?: number;

  @ApiPropertyOptional({ enum: TicketCategoryVisibility })
  @IsOptional()
  @IsEnum(TicketCategoryVisibility)
  visibility?: TicketCategoryVisibility;

  @ApiPropertyOptional() @IsOptional() @IsDateString() valid_from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() valid_until?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() sales_start_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() sales_end_date?: string;
}

/** Modification partielle d'une catégorie de billet (brouillon). */
export class UpdateTicketCategoryDto extends PartialType(CreateTicketCategoryDto) {}

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
}

export class CreatePromoCodeDto {
  @ApiProperty({ example: "ETE10" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,30}$/, { message: "Le code promo doit contenir de 3 à 30 lettres, chiffres, tirets ou soulignés." })
  code: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discount_type: DiscountType;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discount_value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_uses?: number;

  @ApiProperty() @IsDateString() valid_from: string;
  @ApiProperty() @IsDateString() valid_until: string;
}

export class ValidatePromoCodeDto {
  @ApiProperty() @IsUUID("all", { message: "Identifiant d'événement invalide." }) event_id: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty({ message: "Le code promo est obligatoire." })
  @MaxLength(30)
  code: string;
}

/** Réponse de l'organisateur à une demande de complément. */
export class RespondToInfoRequestDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "La réponse est obligatoire." })
  @MaxLength(TEXT_MAX_LENGTH)
  response: string;
}
