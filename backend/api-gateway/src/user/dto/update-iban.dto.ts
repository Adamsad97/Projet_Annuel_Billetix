import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class UpdateIbanDto {
  @ApiProperty({ example: 'FR7630006000011234567890189' })
  @IsString()
  @Matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/, { message: 'Format IBAN invalide' })
  iban: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @IsString()
  @MinLength(2)
  bank_owner_name: string;
}
