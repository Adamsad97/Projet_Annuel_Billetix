import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateOrganizerProfileDto {
  @IsString()
  @IsOptional()
  display_name?: string;

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

  @IsString()
  @IsOptional()
  social_instagram?: string;

  @IsString()
  @IsOptional()
  social_facebook?: string;

  @IsString()
  @IsOptional()
  social_twitter?: string;

  @IsString()
  @IsOptional()
  social_youtube?: string;
}
