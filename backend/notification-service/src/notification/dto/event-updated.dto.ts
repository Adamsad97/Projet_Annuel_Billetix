import { IsEmail, IsString } from 'class-validator';

export class EventUpdatedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;
}
