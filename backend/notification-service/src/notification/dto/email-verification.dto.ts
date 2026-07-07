import { IsEmail, IsString } from 'class-validator';

export class EmailVerificationDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  token: string;
}
