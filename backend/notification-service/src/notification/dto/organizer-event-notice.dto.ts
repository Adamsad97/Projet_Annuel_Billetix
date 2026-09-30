import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

/** Décision ou action de l'administration sur un événement, à annoncer à son organisateur. */
export const ORGANIZER_EVENT_NOTICE_KINDS = [
  'CREATED_FOR_YOU',
  'NON_PROFIT_VERIFIED',
  'NON_PROFIT_REJECTED',
  'SUSPENDED',
  'UNSUSPENDED',
  'HIDDEN',
  'UNHIDDEN',
  'CANCELLED_BY_ADMIN',
  'CANCELLATION_MESSAGE',
  'CANCELLATION_REJECTED',
  'CANCELLATION_APPROVED',
  'POSTPONEMENT_MESSAGE',
  'POSTPONEMENT_REJECTED',
  'POSTPONEMENT_APPROVED',
] as const;

export type OrganizerEventNoticeKind = (typeof ORGANIZER_EVENT_NOTICE_KINDS)[number];

export class OrganizerEventNoticeDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  event_id: string;

  @IsString()
  event_name: string;

  @IsIn(ORGANIZER_EVENT_NOTICE_KINDS)
  kind: OrganizerEventNoticeKind;

  /** Message ou motif saisi par l'admin. */
  @IsString()
  @IsOptional()
  message?: string;
}
