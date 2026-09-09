import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// Le code n'est volontairement pas modifiable ici : il est déjà persisté sur
// tous les events existants qui utilisent cette catégorie (cf. Category.code).
export class UpdateCategoryDto {
  @IsString() @MinLength(2) @MaxLength(60) @IsOptional()
  label?: string;

  @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;

  @IsBoolean() @IsOptional()
  is_active?: boolean;
}
