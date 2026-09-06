import { IsEmail, IsString } from 'class-validator';

export class FirstSaleDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;
}
