import { IsEmail, IsString } from 'class-validator';

export class ResaleWithdrawnDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;
}
