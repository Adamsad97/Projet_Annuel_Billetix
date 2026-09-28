import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const ROLES = ['BUYER', 'ORGANIZER', 'AGENT', 'ADMIN', 'SUPER_ADMIN'];

/** Paramètres visibles selon le rôle de l'admin (sections réservées au super admin). */
export class ListSettingsPayload {
  @IsOptional() @IsIn(ROLES) actor_role?: string;
}

export class UpdateSettingPayload extends ListSettingsPayload {
  @IsString() @Matches(/^[a-z0-9_]{1,100}$/, { message: 'Clé de paramètre invalide.' }) key: string;
  @IsString() @MaxLength(500) value: string;
}
