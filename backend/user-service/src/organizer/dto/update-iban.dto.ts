import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateIbanDto {
  // Espaces et minuscules tolérés ; la clé de contrôle est vérifiée par OrganizerService.
  @IsString()
  @MaxLength(50)
  @Matches(/^\s*[A-Za-z]{2}\s*[0-9]{2}[A-Za-z0-9\s]{11,40}$/, { message: 'Format IBAN invalide' })
  iban: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  bank_owner_name: string;
}
