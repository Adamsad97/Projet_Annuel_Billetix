import { IsEmail, IsOptional, IsString } from 'class-validator';

export class EventCanceledDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsString()
  eventVenue: string;

  @IsString()
  refundAmount: string;

  @IsString()
  @IsOptional()
  cancellationReason?: string;
}
