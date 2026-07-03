import { IsString, Matches, MinLength } from 'class-validator';

export class UpdateIbanDto {
  @IsString()
  @Matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/, { message: 'Format IBAN invalide' })
  iban: string;

  @IsString()
  @MinLength(2)
  bank_owner_name: string;
}
