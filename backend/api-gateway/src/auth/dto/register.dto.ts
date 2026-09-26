import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from "class-validator";

enum RegistrableRole {
  BUYER = "BUYER",
  ORGANIZER = "ORGANIZER",
}

export class RegisterDto {
  @ApiProperty({ example: "jean.dupont@email.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "MonMotDePasse123!", description: "Longueur minimale paramétrable (GET /auth/registration-policy), au moins une majuscule, une minuscule, un chiffre et un caractère spécial, sans le prénom ni le nom — vérifié par auth-service" })
  @IsString()
  password: string;

  @ApiProperty({ example: "Jean" })
  @IsString()
  first_name: string;

  @ApiProperty({ example: "Dupont" })
  @IsString()
  last_name: string;

  @ApiProperty({
    example: "1998-05-12",
    description: "Date de naissance (YYYY-MM-DD) — inscription refusée sous l'âge minimum (GET /auth/registration-policy)",
  })
  @IsDateString(
    { strict: true },
    { message: "La date de naissance est obligatoire (format AAAA-MM-JJ)" },
  )
  birth_date: string;

  @ApiPropertyOptional({ example: "+33612345678" })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    enum: RegistrableRole,
    default: RegistrableRole.BUYER,
  })
  @IsEnum(RegistrableRole)
  @IsOptional()
  role?: RegistrableRole;
}
