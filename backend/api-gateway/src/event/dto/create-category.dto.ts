import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ description: "Ex: CONCERT — majuscules, chiffres, underscore uniquement" })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: "Le code doit être en majuscules (lettres, chiffres, underscore), ex: CONCERT",
  })
  @MaxLength(30)
  code: string;

  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60)
  label: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional() @IsInt() @Min(0) @Max(9999) @IsOptional()
  display_order?: number;
}
