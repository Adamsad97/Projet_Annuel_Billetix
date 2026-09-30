import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Admin prévenu d'une demande d'annulation ou de report d'un organisateur :
 * nouvelle demande (NEW) ou réponse de l'organisateur dans l'échange (MESSAGE).
 */
export class AdminChangeRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsIn(['CANCELLATION', 'POSTPONEMENT'])
  kind: 'CANCELLATION' | 'POSTPONEMENT';

  @IsIn(['NEW', 'MESSAGE'])
  action: 'NEW' | 'MESSAGE';

  @IsString()
  eventName: string;

  /** Date de l'événement, formatée. */
  @IsString()
  eventDate: string;

  @IsString()
  organizerName: string;

  /** Motif de la demande (NEW) ou message de l'organisateur (MESSAGE). */
  @IsString()
  text: string;

  /** Report : nouvelle date proposée, formatée ; absente si « date à venir ». */
  @IsOptional()
  @IsString()
  newDate?: string;
}
