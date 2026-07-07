import { IsEmail, IsString } from 'class-validator';

export class EventInfoRequestedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  event_name: string;

  @IsString()
  message: string;
}
