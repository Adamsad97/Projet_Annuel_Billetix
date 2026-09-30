import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ChangePasswordDto } from "../auth/dto/change-password.dto";
import { OAuthProvider, UserRole } from "../user/user.entity";

/**
 * Messages internes d'auth-service (TCP entre services). Chaque identifiant
 * est vérifié ici une fois pour toutes.
 */
const NAME_MAX = 100;
const TOKEN_MAX = 2048;

export class IdPayload {
  @IsUUID() id: string;
}

export class UserIdPayload {
  @IsUUID() user_id: string;
}

export class TokenPayload {
  @IsString() @MaxLength(TOKEN_MAX) token: string;
}

export class CodePayload {
  @IsString() @MaxLength(TOKEN_MAX) code: string;
}

export class EmailPayload {
  @IsEmail() @MaxLength(254) email: string;
}

/** Invitation d'un agent de contrôle par un organisateur (contexte repris dans l'email). */
export class InviteAgentPayload extends EmailPayload {
  @IsString() @MaxLength(100) first_name: string;
  @IsString() @MaxLength(100) last_name: string;
  @IsString() @MaxLength(200) event_name: string;
  @IsString() @MaxLength(100) event_date: string;
  @IsString() @MaxLength(200) organizer_name: string;
}

/** Résolution par lot : les identifiants mal formés sont tolérés puis ignorés. */
export class IdsPayload {
  @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true }) ids: string[];
}

export class ChangePasswordPayload extends UserIdPayload {
  @ValidateNested() @Type(() => ChangePasswordDto) dto: ChangePasswordDto;
}

// ─── Connexion Google / Facebook ────────────────────────────────────────────

export class OAuthLoginPayload {
  @IsEnum(OAuthProvider) provider: OAuthProvider;
  @IsString() @MaxLength(200) oauth_id: string;
  @IsEmail() email: string;
  @IsString() @MaxLength(NAME_MAX) first_name: string;
  @IsString() @MaxLength(NAME_MAX) last_name: string;
}

/**
 * Résultat d'une connexion Google/Facebook, conservé le temps de l'échange :
 * session complète (jetons + utilisateur), 2FA à saisir, ou date de naissance
 * à compléter. Les trois formes sont déclarées au complet — sinon la
 * validation retirerait des champs et casserait la connexion.
 */
export class OAuthExchangePayload {
  @IsOptional() @IsString() @MaxLength(TOKEN_MAX) access_token?: string;
  @IsOptional() @IsString() @MaxLength(TOKEN_MAX) refresh_token?: string;
  @IsOptional() @IsObject() user?: Record<string, unknown>;
  @IsOptional() @IsBoolean() requires_2fa?: boolean;
  @IsOptional() @IsString() @MaxLength(40) two_factor_method?: string;
  @IsOptional() @IsBoolean() requires_birth_date?: boolean;
  @IsOptional() @IsString() @MaxLength(TOKEN_MAX) pending_token?: string;
  @IsOptional() @IsString() @MaxLength(NAME_MAX) first_name?: string;
}

export class OAuthBirthDatePayload {
  @IsString() @MaxLength(TOKEN_MAX) pending_token: string;
  @IsDateString() birth_date: string;
}

export class OAuthTwoFactorPayload {
  @IsString() @MaxLength(TOKEN_MAX) pending_token: string;
  @IsString() @MaxLength(32) code: string;
}

// ─── 2FA ────────────────────────────────────────────────────────────────────

export class TwoFactorCodePayload extends UserIdPayload {
  @IsString() @MaxLength(32) code: string;
}

export class ResetTwoFactorByAdminPayload extends UserIdPayload {
  @IsUUID() admin_id: string;
  @IsEnum(UserRole) actor_role: UserRole;
}

// ─── Gestion des comptes par un admin ───────────────────────────────────────

export class AdminActionOnUserPayload extends IdPayload {
  @IsUUID() admin_id: string;
  @IsEnum(UserRole) actor_role: UserRole;
}

export class SuspendUserPayload extends AdminActionOnUserPayload {
  @IsString() @MaxLength(2000) reason: string;
}

export class ChangeRolePayload extends AdminActionOnUserPayload {
  @IsEnum(UserRole) role: UserRole;
}

export class ListUsersPayload {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsBoolean() is_suspended?: boolean;
  @IsOptional() @IsIn(["active", "suspended", "locked", "unverified"]) status?: "active" | "suspended" | "locked" | "unverified";
  @IsOptional() @IsIn(["recent", "oldest", "name"]) sort?: "recent" | "oldest" | "name";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class DeleteAccountPayload extends IdPayload {
  @IsOptional() @IsString() @MaxLength(200) password?: string;
}
