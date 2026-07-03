import { IsOptional, IsString } from 'class-validator';

export class UpdateBuyerProfileDto {
  @IsString()
  @IsOptional()
  billing_address_line1?: string;

  @IsString()
  @IsOptional()
  billing_address_line2?: string;

  @IsString()
  @IsOptional()
  billing_city?: string;

  @IsString()
  @IsOptional()
  billing_postal_code?: string;

  @IsString()
  @IsOptional()
  billing_country?: string;
}
