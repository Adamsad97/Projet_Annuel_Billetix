import { IsEmail, IsOptional, IsString } from 'class-validator';

export class KycRejectedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
