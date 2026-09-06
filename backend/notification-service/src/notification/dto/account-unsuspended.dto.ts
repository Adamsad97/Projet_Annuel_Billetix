import { IsEmail, IsString } from 'class-validator';

export class AccountUnsuspendedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;
}
