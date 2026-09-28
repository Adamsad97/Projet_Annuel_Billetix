import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";
import { TEXT_MAX_LENGTH } from "../../common/dto/common.dto";

export class RefundAmountDto {
  @ApiPropertyOptional({ description: "Remboursement partiel, en centimes" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount_cents?: number;
}

/** Notification envoyée par Orange Money (jetons vérifiés par payment-service). */
export class OrangeMoneyWebhookDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(512) pay_token: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) order_id: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(512) notif_token: string;
}

export enum DisputeReason {
  FRAUDULENT = "FRAUDULENT",
  DUPLICATE = "DUPLICATE",
  PRODUCT_NOT_RECEIVED = "PRODUCT_NOT_RECEIVED",
  PRODUCT_UNACCEPTABLE = "PRODUCT_UNACCEPTABLE",
  SUBSCRIPTION_CANCELED = "SUBSCRIPTION_CANCELED",
  GENERAL = "GENERAL",
}

export class CreateDisputeDto {
  @ApiProperty() @IsUUID("all", { message: "Paiement invalide." }) payment_id: string;
  @ApiProperty() @IsUUID("all", { message: "Commande invalide." }) order_id: string;
  @ApiProperty({ enum: DisputeReason }) @IsEnum(DisputeReason) reason: DisputeReason;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(TEXT_MAX_LENGTH) description?: string;
}
