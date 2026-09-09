import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCategoryDto {
  // Ex: CONCERT — lettres majuscules et underscores uniquement, stocké tel
  // quel sur events.category et jamais modifié par la suite.
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Le code doit être en majuscules (lettres, chiffres, underscore), ex: CONCERT',
  })
  @MaxLength(30)
  code: string;

  @IsString() @MinLength(2) @MaxLength(60)
  label: string;

  @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;
}
