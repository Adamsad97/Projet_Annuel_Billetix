import { IsEmail, IsString } from 'class-validator';

export class DisputeOpenedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  orderReference: string;

  @IsString()
  reason: string;
}
