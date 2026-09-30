import { IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Agent de contrôle affecté à un événement. Avec `token` : compte tout juste
 * créé, lien pour choisir son mot de passe. Sans : compte agent existant,
 * simple avis d'affectation.
 */
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
