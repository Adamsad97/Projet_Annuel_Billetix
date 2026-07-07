import { IsEmail, IsString } from 'class-validator';

export class PasswordResetDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  token: string;
}
