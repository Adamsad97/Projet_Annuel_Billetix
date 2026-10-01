import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

// Code modifiable (ex. faute de frappe) : recopié sur les événements qui
// l'utilisent, dans la même transaction (cf. CategoryService.update).
export class UpdateCategoryDto {
  @IsString() @IsOptional() @MaxLength(30)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Le code doit être en majuscules (lettres, chiffres, underscore), ex: CONCERT',
  })
  code?: string;

  @IsString() @MinLength(2) @MaxLength(60) @IsOptional()
  label?: string;

  @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;

  @IsBoolean() @IsOptional()
  is_active?: boolean;
}
