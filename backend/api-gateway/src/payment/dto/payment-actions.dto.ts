import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";
import { TEXT_MAX_LENGTH } from "../../common/dto/common.dto";

export class RefundAmountDto {
  @ApiPropertyOptional({ description: "Remboursement partiel, en centimes" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount_cents?: number;
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
  @ApiProperty() @IsUUID("all", { message: "Commande invalide." }) order_id: string;
  @ApiProperty({ enum: DisputeReason }) @IsEnum(DisputeReason) reason: DisputeReason;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(TEXT_MAX_LENGTH) description?: string;
}
