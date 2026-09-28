import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/** Longueur maximale d'un motif ou d'un message saisi dans un formulaire. */
export const TEXT_MAX_LENGTH = 2000;

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

/** Motif obligatoire (refus, suspension, blocage…). */
export class ReasonDto {
  @ApiProperty({ example: "Informations incomplètes" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Le motif est obligatoire." })
  @MaxLength(TEXT_MAX_LENGTH)
  reason: string;
}

/** Motif facultatif. */
export class OptionalReasonDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  reason?: string;
}

/** Message obligatoire (échange, demande de complément…). */
export class MessageDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Le message est obligatoire." })
  @MaxLength(TEXT_MAX_LENGTH)
  message: string;
}

/** Message facultatif (note jointe à une décision). */
export class OptionalMessageDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  message?: string;
}

/** Pagination des listes : bornée pour éviter les réponses démesurées. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
