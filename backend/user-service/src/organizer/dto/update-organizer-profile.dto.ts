import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateOrganizerProfileDto {
  @IsString()
  @IsOptional()
  display_name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
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
