import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

// Bug corrigé : seul display_name était déclaré — la validation (whitelist)
// retirait donc en silence la présentation, le logo et le site web envoyés
// à la création du profil.
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
