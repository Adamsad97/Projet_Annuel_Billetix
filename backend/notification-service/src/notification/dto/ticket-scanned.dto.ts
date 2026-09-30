import { IsEmail, IsOptional, IsString } from 'class-validator';

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

  // Absent quand il se confond avec le nom de l'événement.
  @IsOptional()
  @IsString()
  artistName?: string;

  @IsString()
  categoryName: string;

  @IsString()
  holderName: string;

  // Date et heure complètes dans le fuseau de l'événement, ex. « le 30 septembre 2026 à 07:05 ».
  @IsString()
  scannedAt: string;
}
