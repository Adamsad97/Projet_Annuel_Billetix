import { IsEmail, IsString } from 'class-validator';

export class AccountUnlockedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;
}
