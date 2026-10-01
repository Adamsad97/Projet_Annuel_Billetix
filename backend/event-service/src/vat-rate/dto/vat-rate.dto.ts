import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateVatRateDto {
  @IsString() @MinLength(2) @MaxLength(80)
  label: string;

  /** Fraction entre 0 et 1 (0.055 pour 5,5 %). */
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(0.9999)
  rate: number;

  @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;

  @IsBoolean() @IsOptional()
  is_default?: boolean;
}

export class UpdateVatRateDto {
  @IsString() @MinLength(2) @MaxLength(80) @IsOptional()
  label?: string;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(0.9999) @IsOptional()
  rate?: number;

  @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;

  @IsBoolean() @IsOptional()
  is_default?: boolean;

  @IsBoolean() @IsOptional()
  is_active?: boolean;
}
