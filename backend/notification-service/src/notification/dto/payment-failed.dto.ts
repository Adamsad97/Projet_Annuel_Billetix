import { IsEmail, IsString } from 'class-validator';

export class PaymentFailedDto {
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
  failureReason: string;
}
