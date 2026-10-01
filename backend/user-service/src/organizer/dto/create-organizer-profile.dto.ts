import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

// Déclare tous les champs du profil, sinon la validation (whitelist) les retirerait.
export class CreateOrganizerProfileDto {
  @IsString()
  @MinLength(2)
  display_name: string;

  @IsString()
  @IsOptional()
  description?: string;

  // require_tld: false — logo hébergé sur MinIO, http://localhost:9000/...
  // en dev (contrairement à website_url, un vrai domaine externe).
  @IsUrl({ require_tld: false })
  @IsOptional()
  logo_url?: string;

  @IsUrl()
  @IsOptional()
  website_url?: string;
}
