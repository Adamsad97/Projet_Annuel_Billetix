import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MinLength } from "class-validator";

// DTO de mise à jour : champs partiels, réseaux sociaux compris.
export class UpdateOrganizerProfileDto {
  @ApiPropertyOptional({ example: "Les Nuits de Paris" })
  @IsString()
  @MinLength(2)
  @IsOptional()
  display_name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  // require_tld: false — logo hébergé sur MinIO, http://localhost:9000/...
  // en dev (contrairement à website_url, un vrai domaine externe).
  @ApiPropertyOptional()
  @IsUrl({ require_tld: false })
  @IsOptional()
  logo_url?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  website_url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  social_instagram?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  social_facebook?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  social_twitter?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  social_youtube?: string;
}
