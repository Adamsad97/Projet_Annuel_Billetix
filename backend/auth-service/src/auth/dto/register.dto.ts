import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from "class-validator";
import { UserRole } from "../../user/user.entity";

// Seuls BUYER et ORGANIZER sont autorisés à l'inscription publique.
// AGENT est créé par un organisateur, ADMIN uniquement en back-office.
const REGISTRABLE_ROLES = [UserRole.BUYER, UserRole.ORGANIZER] as const;
export type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];

export class RegisterDto {
  @IsEmail()
  email: string;

  // Longueur et complexité : AuthService.assertPasswordPolicy()
  // (minimum paramétrable via platform_settings).
  @IsString()
  password: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  // "YYYY-MM-DD" ; obligatoire : l'inscription est réservée aux personnes
  // ayant l'âge minimum (platform_settings), vérifié par AuthService.register().
  @IsDateString(
    { strict: true },
    { message: "La date de naissance est obligatoire (format AAAA-MM-JJ)" },
  )
  birth_date: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsEnum(REGISTRABLE_ROLES)
  @IsOptional()
  role?: RegistrableRole;
}
