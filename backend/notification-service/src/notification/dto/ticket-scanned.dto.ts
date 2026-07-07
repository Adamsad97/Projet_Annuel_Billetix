import { IsEmail, IsString } from 'class-validator';

export class TicketScannedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsString()
  venueName: string;

  @IsString()
  eventCity: string;

  @IsString()
  artistName: string;

  @IsString()
  categoryName: string;

  @IsString()
  holderName: string;

  @IsString()
  scannedAt: string;
}
