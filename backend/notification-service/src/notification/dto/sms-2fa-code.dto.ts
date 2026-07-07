import { IsString } from 'class-validator';

export class Sms2faCodeDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;
}
