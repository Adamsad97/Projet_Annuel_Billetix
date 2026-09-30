import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  Matches,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DisputeReason, DisputeStatus } from '../dispute/dispute.entity';
import { PayoutStatus } from '../payout/payout.entity';

/**
 * Messages internes de payment-service (TCP entre services). Les corps de
 * webhook restent des textes bruts : ils ne sont jamais transformés, pour que
 * la vérification de signature porte sur l'octet près.
 */
const WEBHOOK_MAX = 1_000_000;
const TEXT_MAX = 2000;

export class IdPayload {
  @IsUUID() id: string;
}

export class OrderIdPayload {
  @IsUUID() order_id: string;
}

export class BuyerPayload {
  @IsUUID() buyer_id: string;
}

export class OrganizerPayload {
  @IsUUID() organizer_id: string;
}

// ─── Paiements ──────────────────────────────────────────────────────────────

export class CreateIntentPayload extends OrderIdPayload {
  @IsUUID() buyer_id: string;
  @IsEmail() buyer_email: string;
}

export class RefundPayload extends OrderIdPayload {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) amount_cents?: number;
}

export class ConnectOnboardingPayload extends OrganizerPayload {
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(100) existing_account_id: string | null;
  @IsString() @MaxLength(1000) refresh_url: string;
  @IsString() @MaxLength(1000) return_url: string;
}

export class ConnectAccountPayload {
  @Matches(/^acct_[A-Za-z0-9]+$/) @MaxLength(100) account_id: string;
}

export class StripeWebhookPayload {
  @IsString() @MaxLength(WEBHOOK_MAX) payload: string;
  @IsString() @MaxLength(1000) signature: string;
}

export class PaypalWebhookPayload {
  @IsString() @MaxLength(WEBHOOK_MAX) payload: string;
  @IsObject() headers: Record<string, string>;
}

export class OrangeMoneyCallbackPayload {
  @IsString() @MaxLength(512) pay_token: string;
  @IsString() @MaxLength(100) order_id: string;
  @IsString() @MaxLength(512) notif_token: string;
}

export class WaveWebhookPayload {
  @IsString() @MaxLength(WEBHOOK_MAX) payload: string;
  @IsString() @MaxLength(1000) signatureHeader: string;
}

// ─── Reversements ───────────────────────────────────────────────────────────

export class CreatePayoutPayload extends OrganizerPayload {
  @IsUUID() event_id: string;
  @IsOptional() @IsUUID() order_id?: string;
  @Type(() => Number) @IsNumber() gross_amount: number;
  @Type(() => Number) @IsNumber() commission_amount: number;
  @Type(() => Number) @IsNumber() payment_fees_amount: number;
  @IsOptional() @IsDateString() event_end_at?: string;
}

export class ProcessPayoutPayload extends IdPayload {
  @IsString() @MaxLength(100) stripe_account_id: string;
}

export class BlockPayoutPayload extends IdPayload {
  @IsUUID() admin_id: string;
  @IsString() @MaxLength(TEXT_MAX) reason: string;
}

export class OwnedPayoutPayload extends IdPayload {
  @IsUUID() organizer_id: string;
}

export class AdminPayoutPayload extends IdPayload {
  @IsUUID() admin_id: string;
}

export class ListPayoutsPayload {
  @IsOptional() @IsEnum(PayoutStatus) status?: PayoutStatus;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) organizer_ids?: string[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) event_ids?: string[];
  @IsOptional() @IsDateString() scheduled_from?: string;
  @IsOptional() @IsDateString() scheduled_to?: string;
  @IsOptional() @IsIn(['scheduled_desc', 'scheduled_asc', 'amount_desc']) sort?: 'scheduled_desc' | 'scheduled_asc' | 'amount_desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

// ─── Litiges ────────────────────────────────────────────────────────────────

export class CreateDisputePayload extends OrderIdPayload {
  @IsUUID() payment_id: string;
  @IsUUID() buyer_id: string;
  @IsEnum(DisputeReason) reason: DisputeReason;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) description?: string;
  @IsOptional() @IsString() @MaxLength(100) stripe_dispute_id?: string;
}

export class UpdateDisputeStatusPayload extends IdPayload {
  @IsEnum(DisputeStatus) status: DisputeStatus;
}

export class ResolveDisputePayload extends IdPayload {
  @IsIn([DisputeStatus.WON, DisputeStatus.LOST, DisputeStatus.CLOSED])
  status: DisputeStatus.WON | DisputeStatus.LOST | DisputeStatus.CLOSED;
  @IsUUID() resolved_by: string;
  @IsOptional() @IsString() @MaxLength(TEXT_MAX) resolution_notes?: string;
}
