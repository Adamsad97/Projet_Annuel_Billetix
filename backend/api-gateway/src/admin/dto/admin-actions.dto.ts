import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length, MaxLength, Min, ValidateIf, ValidateNested } from "class-validator";
import { PaginationQueryDto, TEXT_MAX_LENGTH } from "../../common/dto/common.dto";
import { CreateEventDto } from "../../event/dto/create-event.dto";
import { CreateTicketCategoryDto } from "../../event/dto/event-actions.dto";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export const USER_ROLES = ["BUYER", "ORGANIZER", "AGENT", "ADMIN", "SUPER_ADMIN"] as const;

export class ChangeRoleDto {
  @ApiProperty({ enum: USER_ROLES })
  @IsIn(USER_ROLES)
  role: (typeof USER_ROLES)[number];
}

/** Référence à l'organisateur pour qui l'admin agit (accueil physique). */
export class OrganizerRefDto {
  @ApiProperty() @IsUUID("all", { message: "Identifiant d'organisateur invalide." }) organizer_id: string;
}

export class CreateEventForOrganizerDto extends OrganizerRefDto {
  @ApiProperty({ type: CreateEventDto })
  @ValidateNested()
  @Type(() => CreateEventDto)
  dto: CreateEventDto;
}

export class CreateCategoryForOrganizerDto extends OrganizerRefDto {
  @ApiProperty({ type: CreateTicketCategoryDto })
  @ValidateNested()
  @Type(() => CreateTicketCategoryDto)
  dto: CreateTicketCategoryDto;
}

export class VerifyNonProfitDto {
  @ApiProperty() @IsBoolean() approved: boolean;

  // Motif du refus, obligatoire et communiqué à l'organisateur. Une seule
  // règle (Length) : un seul message, même quand le champ est absent.
  @ApiPropertyOptional()
  @Transform(trim)
  @ValidateIf((dto: VerifyNonProfitDto) => dto.approved === false)
  @Length(1, TEXT_MAX_LENGTH, { message: `Le motif du refus est obligatoire (${TEXT_MAX_LENGTH} caractères maximum).` })
  reason?: string;
}

export const DISPUTE_RESOLUTIONS = ["WON", "LOST", "CLOSED"] as const;

export class ResolveDisputeDto {
  @ApiProperty({ enum: DISPUTE_RESOLUTIONS })
  @IsIn(DISPUTE_RESOLUTIONS)
  status: (typeof DISPUTE_RESOLUTIONS)[number];

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  resolution_notes?: string;

  /** Acheteur dans son droit (LOST) : remboursement total de la commande. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  refund_full?: boolean;

  /** Acheteur dans son droit (LOST) : remboursement partiel, en centimes. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  refund_amount_cents?: number;
}

export class UpdateSettingDto {
  @ApiProperty({ example: "30" })
  @IsString()
  @MaxLength(500)
  value: string;
}

export class SendNewsletterDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "L'objet est obligatoire." })
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: "Le contenu est obligatoire." })
  @MaxLength(20_000)
  body: string;
}

export class ForceRefundDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Le motif est obligatoire." })
  @MaxLength(TEXT_MAX_LENGTH)
  reason: string;

  @ApiPropertyOptional({ description: "Remboursement partiel, en centimes" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount_cents?: number;
}

// ─── Filtres des listes ─────────────────────────────────────────────────────

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q?: string;
  @ApiPropertyOptional({ enum: USER_ROLES }) @IsOptional() @IsIn(USER_ROLES) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(["true", "false"]) is_suspended?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(["active", "suspended", "locked", "unverified"]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(["recent", "oldest", "name"]) sort?: string;
}

export class AdminEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(["upcoming", "past"]) when?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(["created_desc", "start_asc", "start_desc", "title"]) sort?: string;
}

export class AdminPayoutsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(["PENDING", "PROCESSING", "TO_TRANSFER", "COMPLETED", "BLOCKED", "FAILED"]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) scheduled_from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) scheduled_to?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(["scheduled_desc", "scheduled_asc", "amount_desc"]) sort?: string;
}

export class CancellationRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]) status?: string;
}

export class AuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) entity_type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) entity_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) performed_by?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q?: string;
}
