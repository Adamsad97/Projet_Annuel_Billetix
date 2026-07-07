import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class EventReminderDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsString()
  eventTime: string;

  @IsString()
  eventVenue: string;

  @IsString()
  @IsOptional()
  eventAddress?: string;

  @IsBoolean()
  @IsOptional()
  requiresId?: boolean;
}
