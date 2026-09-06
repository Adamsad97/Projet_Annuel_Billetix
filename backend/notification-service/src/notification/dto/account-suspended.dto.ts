import { IsEmail, IsOptional, IsString } from 'class-validator';

export class AccountSuspendedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
