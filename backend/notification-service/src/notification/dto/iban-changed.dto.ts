import { IsEmail, IsInt, IsString, Min } from 'class-validator';

export class IbanChangedDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  /** « FR76 •••• •••• 1234 » : jamais l'IBAN complet dans un email. */
  @IsString()
  ibanMasked: string;

  @IsString()
  changedAt: string;

  @IsInt()
  @Min(0)
  holdHours: number;
}
