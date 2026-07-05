import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateBuyerProfileDto {
  @ApiPropertyOptional({ example: "12 rue de la Paix" })
  @IsString()
  @IsOptional()
  billing_address_line1?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  billing_address_line2?: string;

  @ApiPropertyOptional({ example: "Paris" })
  @IsString()
  @IsOptional()
  billing_city?: string;

  @ApiPropertyOptional({ example: "75001" })
  @IsString()
  @IsOptional()
  billing_postal_code?: string;

  @ApiPropertyOptional({ example: "FR" })
  @IsString()
  @IsOptional()
  billing_country?: string;
}
