import { IsEmail, IsString } from 'class-validator';

export class RefundCompletedDto {
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
  refundType: string;
}
