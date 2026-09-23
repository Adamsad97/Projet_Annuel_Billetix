import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MinLength } from "class-validator";

// Bug corrigé : PATCH /organizer/profile utilisait CreateOrganizerProfileDto
// à la place — display_name y est obligatoire (empêchait toute mise à jour
// partielle sans le renvoyer) et les réseaux sociaux en étaient absents
// (silencieusement supprimés par le ValidationPipe global whitelist:true
// avant même d'atteindre user-service, qui les supporte pourtant).
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
