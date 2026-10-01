import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ResaleStatus } from '../resale/ticket-resale.entity';
import { TransferRevertSource } from '../transfer/ticket-transfer.entity';
import { RevertRequestStatus } from '../transfer/transfer-revert-request.entity';

/** Messages internes de ticket-service, chaque identifiant vérifié ici. */
const TEXT_MAX = 2000;
const NAME_MAX = 100;

export class IdPayload {
  @IsUUID() id: string;
}
export class EventIdPayload {
  @IsUUID() event_id: string;
}
/** Nouvelles dates d'un événement reporté, recopiées sur ses billets/commandes. */
export class EventDatesPayload {
  @IsUUID() event_id: string;
  @IsDateString() event_start_at: string;
  @IsDateString() event_end_at: string;
}

export class OrderIdPayload {
  @IsUUID() order_id: string;
}
export class UserIdPayload {
  @IsUUID() user_id: string;
}
export class BuyerPayload {
  @IsUUID() buyer_id: string;
}
export class TicketIdPayload {
  @IsUUID() ticket_id: string;
}
export class ResaleIdPayload {
  @IsUUID() resale_id: string;
}

// ─── Génération des billets (après paiement) ────────────────────────────────

export class TicketItemPayload {
  @IsUUID() order_item_id: string;
  @IsUUID() ticket_category_id: string;
  @IsString() @MaxLength(NAME_MAX) ticket_category_name: string;
  // Colonne décimale côté order-service : reçue en texte (« 12.00 »).
  @Type(() => Number) @IsNumber() @Min(0) unit_price_ttc: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity: number;
  @IsOptional() @IsString() @MaxLength(NAME_MAX) holder_first_name?: string;
  @IsOptional() @IsString() @MaxLength(NAME_MAX) holder_last_name?: string;
  @IsOptional() @IsString() @MaxLength(NAME_MAX) seat_info?: string;
}

export class GenerateTicketsPayload {
  @IsUUID() order_id: string;
  @IsUUID() buyer_id: string;
  @IsEmail() buyer_email: string;
  @IsString() @MaxLength(NAME_MAX) buyer_first_name: string;
  @IsString() @MaxLength(NAME_MAX) buyer_last_name: string;
  @IsUUID() event_id: string;
  @IsString() @MaxLength(200) event_name: string;
  @IsDateString() event_start_at: string;
  @IsOptional() @IsDateString() event_end_at?: string;
  @IsString() @MaxLength(200) event_venue_name: string;
  @IsString() @MaxLength(300) event_venue_address: string;
  @IsString() @MaxLength(NAME_MAX) event_city: string;
  @IsOptional() @IsString() @MaxLength(1000) event_poster_url?: string;
  @IsString() @MaxLength(200) artist_name: string;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) artist_description?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TicketItemPayload)
  items: TicketItemPayload[];
}

// ─── Contrôle d'accès ───────────────────────────────────────────────────────

/** Accès aux données de contrôle d'un événement (paquet hors ligne, entrées). */
export class ControlAccessPayload extends EventIdPayload {
  @IsUUID() requester_id: string;
  @IsBoolean() is_organizer: boolean;
}

export class ScanPayload extends EventIdPayload {
  @IsString() @MaxLength(512) qr_token: string;
  @IsUUID() agent_id: string;
  @IsOptional() @IsString() @MaxLength(300) device_info?: string;
  @IsOptional() @IsBoolean() is_offline?: boolean;
  @IsOptional() @IsDateString() scanned_at?: string;
  @IsOptional() @IsBoolean() is_organizer?: boolean;
}

export class OfflineScanEntryPayload {
  @IsString() @MaxLength(512) qr_token: string;
  @IsOptional() @IsUUID() ticket_id?: string;
  @IsDateString() scanned_at_offline: string;
  @IsOptional() @IsString() @MaxLength(300) device_info?: string;
}

export class SyncOfflinePayload extends EventIdPayload {
  @IsUUID() agent_id: string;
  @IsArray() @ArrayMaxSize(5000) @ValidateNested({ each: true }) @Type(() => OfflineScanEntryPayload)
  entries: OfflineScanEntryPayload[];
  @IsOptional() @IsBoolean() is_organizer?: boolean;
}

export class AgentEventPayload extends UserIdPayload {
  @IsUUID() event_id: string;
}

export class AssignAgentPayload extends AgentEventPayload {
  @IsUUID() assigned_by: string;
  @IsOptional() @IsBoolean() is_supervisor?: boolean;
}

// ─── Billets ────────────────────────────────────────────────────────────────

export class VerifyQrPayload {
  @IsString() @MaxLength(512) token: string;
}

export class MarkUsedPayload extends IdPayload {
  @IsUUID() agent_id: string;
  @IsOptional() @IsString() @MaxLength(300) device_info?: string;
}

export class InvalidateTicketPayload extends IdPayload {
  @IsUUID() admin_id: string;
  @IsString() @MaxLength(TEXT_MAX) reason: string;
}

/** Nouveau titulaire après une revente. */
export class NewBuyerFields {
  @IsUUID() new_buyer_id: string;
  @IsUUID() new_order_id: string;
  @IsEmail() new_buyer_email: string;
  @IsString() @MaxLength(NAME_MAX) new_holder_first_name: string;
  @IsString() @MaxLength(NAME_MAX) new_holder_last_name: string;
}

export class TransferToNewBuyerPayload extends NewBuyerFields {
  @IsUUID() id: string;
}

// ─── Revente ────────────────────────────────────────────────────────────────

export class RequestResalePayload extends TicketIdPayload {
  @IsUUID() buyer_id: string;
  @IsUUID() original_order_id: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) resale_price: number;
}

export class ResaleBuyerPayload extends ResaleIdPayload {
  @IsUUID() buyer_id: string;
}

export class CompleteResalePayload extends NewBuyerFields {
  @IsUUID() resale_id: string;
}

export class ListResalesAdminPayload {
  @IsOptional() @IsEnum(ResaleStatus) status?: ResaleStatus;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) user_ids?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

// ─── Dons de billets ────────────────────────────────────────────────────────

export class GiftTicketPayload extends TicketIdPayload {
  @IsUUID() from_user_id: string;
  @IsString() @MaxLength(NAME_MAX) from_first_name: string;
  @IsString() @MaxLength(NAME_MAX) from_last_name: string;
  @IsUUID() to_user_id: string;
  @IsEmail() to_email: string;
  @IsString() @MaxLength(NAME_MAX) to_holder_first_name: string;
  @IsString() @MaxLength(NAME_MAX) to_holder_last_name: string;
  @IsOptional() @IsString() @MaxLength(100) ip_address?: string | null;
  @IsOptional() @IsString() @MaxLength(500) user_agent?: string | null;
}

export class RequestTransferRevertPayload extends UserIdPayload {
  @IsUUID() transfer_id: string;
  @IsString() @MaxLength(TEXT_MAX) reason: string;
}

export class RevertTransferPayload {
  @IsUUID() transfer_id: string;
  @IsUUID() admin_id: string;
  @IsEmail() admin_email: string;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) reason?: string | null;
  @IsEnum(TransferRevertSource) source: TransferRevertSource;
  @IsOptional() @IsUUID() request_id?: string;
}

export class RejectTransferRevertPayload {
  @IsUUID() request_id: string;
  @IsUUID() admin_id: string;
  @IsEmail() admin_email: string;
  @IsString() @MaxLength(TEXT_MAX) reason: string;
}

export class ListRevertRequestsPayload {
  @IsOptional() @IsEnum(RevertRequestStatus) status?: RevertRequestStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ListTransfersPayload {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsUUID() event_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
