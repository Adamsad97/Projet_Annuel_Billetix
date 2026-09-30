import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

// Nombre maximal de scans envoyés en une fois après une coupure réseau.
const OFFLINE_BATCH_MAX = 5_000;

export class RequestResaleDto {
  @ApiProperty() @IsUUID("all", { message: "Commande d'origine invalide." }) original_order_id: string;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  resale_price: number;
}

export class OrderRefDto {
  @ApiProperty() @IsUUID("all", { message: "Commande invalide." }) order_id: string;
}

export class EventRefDto {
  @ApiProperty() @IsUUID("all", { message: "Identifiant d'événement invalide." }) event_id: string;
}

export class ScanTicketDto extends EventRefDto {
  @ApiProperty() @IsString() @IsNotEmpty({ message: "Le QR code est vide." }) @MaxLength(512) qr_token: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) device_info?: string;
}

export class OfflineScanEntryDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(512) qr_token: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ticket_id?: string;
  @ApiProperty() @IsDateString() scanned_at_offline: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) device_info?: string;
}

export class SyncOfflineScansDto extends EventRefDto {
  @ApiProperty({ type: [OfflineScanEntryDto] })
  @IsArray()
  @ArrayMaxSize(OFFLINE_BATCH_MAX)
  @ValidateNested({ each: true })
  @Type(() => OfflineScanEntryDto)
  entries: OfflineScanEntryDto[];
}

/**
 * Invitation d'un agent de contrôle par son email. Prénom et nom servent à
 * créer son compte s'il n'en a pas encore (ignorés sinon).
 */
export class AssignAgentDto {
  @ApiProperty() @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail({}, { message: "L'adresse email de l'agent n'est pas valide." }) @MaxLength(254)
  email: string;

  @ApiProperty() @IsString() @IsNotEmpty({ message: "Le prénom de l'agent est obligatoire." }) @MaxLength(100)
  first_name: string;

  @ApiProperty() @IsString() @IsNotEmpty({ message: "Le nom de l'agent est obligatoire." }) @MaxLength(100)
  last_name: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() is_supervisor?: boolean;
}
