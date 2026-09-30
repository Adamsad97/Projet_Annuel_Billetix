import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { UpdateCategoryDto } from '../category/dto/update-category.dto';
import { CancellationMessageAuthor } from '../event/cancellation/cancellation-message.entity';
import { CancellationRequestStatus, ChangeRequestKind } from '../event/cancellation/cancellation-request.entity';
import { DiscountType } from '../promo-code/promo-code.entity';
import { CreateTicketCategoryDto } from '../ticket-category/dto/create-ticket-category.dto';
import { CategoryVisibility } from '../ticket-category/ticket-category.entity';
import { UpdateTicketTierTypeDto } from '../ticket-tier-type/dto/update-ticket-tier-type.dto';
import { EventIdPayload, IdPayload, OrganizerPayload, OwnedIdPayload } from './payloads';

const TEXT_MAX = 2000;

// ─── Catégories de billets ──────────────────────────────────────────────────

export class CreateTicketCategoryPayload extends OrganizerPayload {
  @ValidateNested() @Type(() => CreateTicketCategoryDto) dto: CreateTicketCategoryDto;
}

export class UpdateTicketCategoryDto {
  @IsOptional() @IsString() @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) description?: string;
  @IsOptional() @IsNumber() @Min(0) price_ht?: number;
  @IsOptional() @IsInt() @Min(1) quota?: number;
  @IsOptional() @IsInt() @Min(1) max_per_order?: number;
  @IsOptional() @IsEnum(CategoryVisibility) visibility?: CategoryVisibility;
  @IsOptional() @IsDateString() valid_from?: string;
  @IsOptional() @IsDateString() valid_until?: string;
  @IsOptional() @IsDateString() sales_start_date?: string;
  @IsOptional() @IsDateString() sales_end_date?: string;
}

export class UpdateTicketCategoryPayload extends OwnedIdPayload {
  @ValidateNested() @Type(() => UpdateTicketCategoryDto) dto: UpdateTicketCategoryDto;
}

// ─── Codes promo ────────────────────────────────────────────────────────────

export class CreatePromoCodeDto {
  @IsUUID() event_id: string;
  @IsString() @Matches(/^[A-Z0-9_-]{3,30}$/, { message: 'Le code promo doit contenir de 3 à 30 lettres, chiffres, tirets ou soulignés.' })
  code: string;
  @IsEnum(DiscountType) discount_type: DiscountType;
  @IsNumber() @Min(0.01) discount_value: number;
  @IsOptional() @IsInt() @Min(1) max_uses?: number;
  @IsDateString() valid_from: string;
  @IsDateString() valid_until: string;
}

export class CreatePromoCodePayload extends OrganizerPayload {
  @ValidateNested() @Type(() => CreatePromoCodeDto) dto: CreatePromoCodeDto;
}

export class ValidatePromoCodePayload extends EventIdPayload {
  @IsString() @MaxLength(30) code: string;
}

// ─── Référentiels (catégories d'événement, types de billet) ─────────────────

export class UpdateCategoryPayload extends IdPayload {
  @ValidateNested() @Type(() => UpdateCategoryDto) dto: UpdateCategoryDto;
}

export class UpdateTicketTierTypePayload extends IdPayload {
  @ValidateNested() @Type(() => UpdateTicketTierTypeDto) dto: UpdateTicketTierTypeDto;
}

// ─── Demandes d'annulation ──────────────────────────────────────────────────

export class RequestCancellationPayload extends EventIdPayload {
  @IsUUID() organizer_id: string;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) reason?: string;
  @IsOptional() @IsEnum(ChangeRequestKind) kind?: ChangeRequestKind;
  @IsOptional() @IsDateString() new_start_date?: string;
  @IsOptional() @IsDateString() new_end_date?: string;
}

export class RescheduleEventPayload extends IdPayload {
  @IsUUID() organizer_id: string;
  @IsDateString() start_date: string;
  @IsDateString() end_date: string;
}

export class CancellationsByEventPayload extends EventIdPayload {
  @IsOptional() @IsUUID() organizer_id?: string;
}

export class CancellationsAdminListPayload {
  @IsOptional() @IsEnum(CancellationRequestStatus) status?: CancellationRequestStatus;
  @IsOptional() @IsEnum(ChangeRequestKind) kind?: ChangeRequestKind;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class CancellationMessagePayload extends IdPayload {
  @IsUUID() author_id: string;
  @IsIn(Object.values(CancellationMessageAuthor)) author_role: CancellationMessageAuthor;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) message?: string;
}

export class CancellationWithdrawPayload extends OwnedIdPayload {}

export class CancellationDecisionPayload extends IdPayload {
  @IsUUID() admin_id: string;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) message?: string;
}
