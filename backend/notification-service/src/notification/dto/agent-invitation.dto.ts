import { IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Agent affecté à un événement : avec token, lien pour choisir son mot de passe ; sans, simple avis d'affectation. */
export class AgentInvitationDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsString()
  organizerName: string;

  @IsOptional()
  @IsString()
  token?: string;

  /** Validité du lien (heures), présent avec `token`. */
  @IsOptional()
  @IsInt()
  @Min(1)
  validHours?: number;
}
