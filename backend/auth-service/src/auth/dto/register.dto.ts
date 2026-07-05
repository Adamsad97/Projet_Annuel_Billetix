import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from "class-validator";
import { UserRole } from "../../user/user.entity";

// Seuls BUYER et ORGANIZER sont autorisés à l'inscription publique.
// AGENT est créé par un organisateur, ADMIN uniquement en back-office.
const REGISTRABLE_ROLES = [UserRole.BUYER, UserRole.ORGANIZER] as const;
export type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsEnum(REGISTRABLE_ROLES)
  @IsOptional()
  role?: RegistrableRole;
}
