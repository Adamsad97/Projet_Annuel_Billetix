import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsUUID()
  order_id: string;

  @IsNumber()
  @IsPositive()
  amount_ttc: number;
}
