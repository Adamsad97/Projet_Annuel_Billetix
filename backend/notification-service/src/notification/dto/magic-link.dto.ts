import { IsEmail, IsInt, IsString, Min } from 'class-validator';

export class MagicLinkDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  token: string;

  @IsInt()
  @Min(1)
  expiresInMinutes: number;
}
