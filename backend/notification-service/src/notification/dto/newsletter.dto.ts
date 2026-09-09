import { IsEmail, IsString } from 'class-validator';

export class NewsletterDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;
}
