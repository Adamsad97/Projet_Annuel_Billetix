import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { AdminActionDto } from '../event/dto/admin-action.dto';

/** Messages internes récurrents, chaque identifiant vérifié ici une fois pour toutes. */
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

/** Résolution par lot : un identifiant mal formé est ignoré sans faire échouer le lot. */
export class IdsPayload {
  @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true }) ids: string[];
}

