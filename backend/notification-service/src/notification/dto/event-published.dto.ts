import { IsEmail, IsString } from 'class-validator';

export class EventPublishedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  event_id: string;

  @IsString()
  event_name: string;
}
