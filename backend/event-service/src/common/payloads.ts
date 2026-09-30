import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { AdminActionDto } from '../event/dto/admin-action.dto';

/**
 * Messages internes récurrents (TCP entre services). Chaque identifiant est
 * vérifié ici, une fois pour toutes, au lieu d'un isUUID recopié dans les
 * services.
 */
export class IdPayload {
  @IsUUID() id: string;
}

export class SlugPayload {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug: string;
}

export class EventIdPayload {
  @IsUUID() event_id: string;
}

export class OrganizerPayload {
  @IsUUID() organizer_id: string;
}

/** Ressource d'un organisateur (propriété vérifiée par le service). */
export class OwnedIdPayload extends IdPayload {
  @IsUUID() organizer_id: string;
}

export class AdminIdPayload extends IdPayload {
  @IsUUID() admin_id: string;
}

export class AdminActionPayload extends AdminIdPayload {
  @ValidateNested() @Type(() => AdminActionDto) dto: AdminActionDto;
}

export class QuantityPayload extends IdPayload {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) quantity: number;
}

/**
 * Résolution par lot : les identifiants mal formés sont tolérés puis ignorés
 * par le service (un seul ne doit pas faire échouer tout le lot).
 */
export class IdsPayload {
  @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true }) ids: string[];
}

