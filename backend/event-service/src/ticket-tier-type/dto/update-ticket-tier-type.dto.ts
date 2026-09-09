import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateTicketTierTypeDto {
  @IsString() @MinLength(2) @MaxLength(60) @IsOptional()
  label?: string;

  @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;

  @IsBoolean() @IsOptional()
  is_active?: boolean;
}
