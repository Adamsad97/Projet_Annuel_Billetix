import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AdminIdPayload, IdPayload, OrganizerPayload, OwnedIdPayload } from '../../common/payloads';
import { EventStatus, RefundPolicy } from '../event.entity';
import { AdminActionDto } from './admin-action.dto';
import { CreateEventDto } from './create-event.dto';

const TEXT_MAX = 5000;

export class CreateEventPayload extends OrganizerPayload {
  @ValidateNested() @Type(() => CreateEventDto) dto: CreateEventDto;
}

/** Modification : tous les champs sont facultatifs (le service n'applique que ceux autorisés selon le statut). */
export class UpdateEventDto {
  @IsOptional() @IsString() @MinLength(5) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(TEXT_MAX) description?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsBoolean() is_non_profit?: boolean;
  @IsOptional() @IsUrl({ require_tld: false }) non_profit_document_url?: string;
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
  @IsOptional() @IsString() @MaxLength(200) venue_name?: string;
  @IsOptional() @IsString() @MaxLength(200) venue_address_line1?: string;
  @IsOptional() @IsString() @MaxLength(200) venue_address_line2?: string;
  @IsOptional() @IsString() @MaxLength(100) venue_city?: string;
  @IsOptional() @IsString() @MaxLength(20) venue_postal_code?: string;
  @IsOptional() @IsString() @MaxLength(60) venue_country?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) venue_latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) venue_longitude?: number;
  @IsOptional() @IsUrl({ require_tld: false }) poster_url?: string;
  @IsOptional() @IsInt() @Min(1) total_capacity?: number;
  @IsOptional() @IsDateString() sales_start_date?: string;
  @IsOptional() @IsDateString() sales_end_date?: string;
  @IsOptional() @IsEnum(RefundPolicy) refund_policy?: RefundPolicy;
  @IsOptional() @IsInt() @Min(1) refund_deadline_days?: number;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) access_conditions?: string;
}

export class UpdateEventPayload extends OwnedIdPayload {
  @ValidateNested() @Type(() => UpdateEventDto) dto: UpdateEventDto;
}

/** Période nommée (« today », « weekend »…) dont on compte les événements. */
export class PeriodPayload {
  @IsString() @Matches(/^[a-z_]{1,20}$/) key: string;
  @IsDateString() from: string;
  @IsOptional() @IsDateString() to?: string;
}

export class CountInPeriodsPayload {
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => PeriodPayload) periods: PeriodPayload[];
}

/** Filtres du catalogue public. */
export class ListPublishedPayload {
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) min_price?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) max_price?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(20_000) radius_km?: number;
  @IsOptional() @IsDateString() date_from?: string;
  @IsOptional() @IsDateString() date_to?: string;
  @IsOptional() @IsIn(['date', 'recent', 'price_asc', 'price_desc']) sort?: 'date' | 'recent' | 'price_asc' | 'price_desc';
}

/** Liste admin de tous les événements. */
export class ListAllEventsPayload {
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsIn(['upcoming', 'past']) when?: 'upcoming' | 'past';
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) organizer_ids?: string[];
  @IsOptional() @IsIn(['created_desc', 'start_asc', 'start_desc', 'title']) sort?: 'created_desc' | 'start_asc' | 'start_desc' | 'title';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class RecommendationPayload {
  @IsString() @MaxLength(60) category: string;
  @IsArray() @IsString({ each: true }) exclude_event_ids: string[];
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit: number;
}

export class VerifyNonProfitPayload extends AdminIdPayload {
  @IsBoolean() approved: boolean;
  // Motif du refus, communiqué à l'organisateur.
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class CancelEventPayload extends IdPayload {
  @IsUUID() actor_id: string;
  @ValidateNested() @Type(() => AdminActionDto) dto: AdminActionDto;
  @IsOptional() @IsBoolean() is_admin?: boolean;
}

export class RequestInfoPayload extends AdminIdPayload {
  @IsString() @MinLength(1) @MaxLength(TEXT_MAX) message: string;
}

export class RespondToInfoPayload {
  @IsUUID() request_id: string;
  @IsUUID() organizer_id: string;
  @IsString() @MinLength(1) @MaxLength(TEXT_MAX) response: string;
}
