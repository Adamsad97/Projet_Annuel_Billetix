import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateTicketTierTypeDto {
  @ApiPropertyOptional() @IsString() @MinLength(2) @MaxLength(60) @IsOptional()
  label?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional() @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;

  @ApiPropertyOptional() @IsBoolean() @IsOptional()
  is_active?: boolean;
}
