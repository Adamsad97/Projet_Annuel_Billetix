import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Acheteur prévenu d'un report : POSTPONED à l'acceptation du report (avec
 * ou sans nouvelle date), RESCHEDULED quand la nouvelle date est fixée.
 */
export class EventPostponedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsIn(['POSTPONED', 'RESCHEDULED'])
  announcement: 'POSTPONED' | 'RESCHEDULED';

  /** Date annoncée à l'achat, déjà formatée. */
  @IsString()
  originalDate: string;

  /** Nouvelle date formatée ; absente tant qu'elle n'est pas connue. */
  @IsOptional()
  @IsString()
  newDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  /** Dernier jour pour demander le remboursement, formaté (si la nouvelle date est connue). */
  @IsOptional()
  @IsString()
  refundDeadline?: string;
}
