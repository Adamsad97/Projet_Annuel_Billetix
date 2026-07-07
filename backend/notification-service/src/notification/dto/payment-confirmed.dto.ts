import { IsEmail, IsString } from 'class-validator';

export class PaymentConfirmedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  orderReference: string;

  @IsString()
  eventName: string;

  @IsString()
  amount: string;

  @IsString()
  paymentDate: string;

  @IsString()
  paymentMethod: string;
}
