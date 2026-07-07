import { IsEmail, IsString } from 'class-validator';

export class WelcomeDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;
}
