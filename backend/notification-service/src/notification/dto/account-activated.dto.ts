import { IsEmail, IsString } from 'class-validator';

export class AccountActivatedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;
}
