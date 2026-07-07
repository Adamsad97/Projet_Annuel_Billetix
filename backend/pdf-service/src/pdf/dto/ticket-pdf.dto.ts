import { IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';

export class TicketPdfDto {
  @IsString()
  ticket_id: string;

  @IsString()
  reference: string;

  @IsString()
  order_id: string;

  @IsString()
  event_name: string;

  @IsString()
  event_start_at: string;

  @IsString()
  event_venue_name: string;

  @IsString()
  event_venue_address: string;

  @IsString()
  event_city: string;

  @IsString()
  @IsOptional()
  event_poster_url?: string;

  @IsString()
  artist_name: string;

  @IsString()
  ticket_category_name: string;

  @IsNumber()
  unit_price_ttc: number;

  @IsString()
  @IsOptional()
  seat_info?: string;

  @IsString()
  holder_first_name: string;

  @IsString()
  holder_last_name: string;

  @IsEmail()
  buyer_email: string;

  @IsString()
  qr_code_url: string;
}
