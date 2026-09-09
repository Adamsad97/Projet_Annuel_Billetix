import { IsEmail, IsString } from 'class-validator';

export class ResaleListedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  resalePrice: string;
}
