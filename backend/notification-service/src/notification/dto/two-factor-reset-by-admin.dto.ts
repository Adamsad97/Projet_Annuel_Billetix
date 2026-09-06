import { IsEmail, IsString } from 'class-validator';

export class TwoFactorResetByAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  reason: string;
}
