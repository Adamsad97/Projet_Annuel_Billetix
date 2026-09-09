import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateTicketTierTypeDto {
  @ApiProperty({ description: "Ex: VIP, Standard, Early Bird" })
  @IsString() @MinLength(2) @MaxLength(60)
  label: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional() @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;
}
