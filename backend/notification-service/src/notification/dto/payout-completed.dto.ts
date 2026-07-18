import { IsEmail, IsString } from 'class-validator';

export class PayoutCompletedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  amount: string;

  @IsString()
  payoutDate: string;
}
