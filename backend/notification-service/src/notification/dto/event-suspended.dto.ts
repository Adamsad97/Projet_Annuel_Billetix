import { IsEmail, IsOptional, IsString } from 'class-validator';

export class EventSuspendedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  event_name: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
