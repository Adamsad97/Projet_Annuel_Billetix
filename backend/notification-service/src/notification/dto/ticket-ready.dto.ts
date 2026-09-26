import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

class TicketReadyItemDto {
  @IsString()
  ticketNumber: string;

  @IsString()
  categoryName: string;

  @IsString()
  @IsOptional()
  seatInfo?: string;
  // Ni QR code ni PDF dans l'email (sécurité) : le billet se consulte dans
  // l'application, après connexion.
}

export class TicketReadyDto {
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketReadyItemDto)
  tickets: TicketReadyItemDto[];
}
