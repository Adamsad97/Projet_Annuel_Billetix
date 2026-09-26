import { IsEmail, IsString } from 'class-validator';

/** Billet offert : un email au bénéficiaire, un email de confirmation à l'expéditeur. */
export class TicketTransferredDto {
  @IsString()
  ticketReference: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsString()
  eventVenue: string;

  @IsString()
  categoryName: string;

  @IsEmail()
  senderEmail: string;

  @IsString()
  senderFirstName: string;

  @IsString()
  senderLastName: string;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  recipientFirstName: string;

  // Personne qui assistera à l'événement (peut différer du compte bénéficiaire).
  @IsString()
  holderFirstName: string;

  @IsString()
  holderLastName: string;

  @IsString()
  transferredAt: string;
}
