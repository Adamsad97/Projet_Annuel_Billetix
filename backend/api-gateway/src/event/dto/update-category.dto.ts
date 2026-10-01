import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateCategoryDto {
  // Modifiable (ex. faute de frappe) : recopié sur les événements qui l'utilisent.
  @ApiPropertyOptional({ description: "Ex: CONCERT — majuscules, chiffres, underscore uniquement" })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: "Le code doit être en majuscules (lettres, chiffres, underscore), ex: CONCERT",
  })
  @MaxLength(30)
  code?: string;

  @ApiPropertyOptional() @IsString() @MinLength(2) @MaxLength(60) @IsOptional()
  label?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional() @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;

  @ApiPropertyOptional() @IsBoolean() @IsOptional()
  is_active?: boolean;
}
