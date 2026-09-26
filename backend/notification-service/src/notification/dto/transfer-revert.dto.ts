import { IsEmail, IsOptional, IsString } from 'class-validator';

/** Champs communs aux emails d'annulation de transfert. */
class TransferRevertBaseDto {
  @IsString()
  ticketReference: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsEmail()
  senderEmail: string;

  @IsString()
  senderFirstName: string;
}

/** Transfert annulé par un admin : billet rendu à l'expéditeur. */
export class TransferRevertedDto extends TransferRevertBaseDto {
  @IsEmail()
  recipientEmail: string;

  @IsString()
  @IsOptional()
  recipientFirstName?: string;

  // Titulaire d'origine, de nouveau sur le billet.
  @IsString()
  holderFirstName: string;

  @IsString()
  holderLastName: string;
}

/** Demande d'annulation reçue (accusé de réception à l'expéditeur). */
export class TransferRevertRequestedDto extends TransferRevertBaseDto {
  @IsEmail()
  recipientEmail: string;
}

/** Demande d'annulation refusée par un admin. */
export class TransferRevertRejectedDto extends TransferRevertBaseDto {
  @IsEmail()
  recipientEmail: string;

  @IsString()
  decisionReason: string;
}
