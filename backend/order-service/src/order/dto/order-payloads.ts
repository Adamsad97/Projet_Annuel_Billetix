import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/**
 * Messages internes d'order-service (TCP entre services). Chaque identifiant
 * est vérifié ici une fois pour toutes.
 */
export class IdPayload {
  @IsUUID() id: string;
}

/** Nouvelles dates d'un événement reporté, recopiées sur ses billets/commandes. */
export class EventDatesPayload {
  @IsUUID() event_id: string;
  @IsDateString() event_start_at: string;
  @IsDateString() event_end_at: string;
}

export class BuyerPayload {
  @IsUUID() buyer_id: string;
}

export class EventIdPayload {
  @IsUUID() event_id: string;
}

export class ReleaseReservationPayload {
  @IsString() @MaxLength(200) reservation_token: string;
}

export class SalesTrendPayload {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

export class RecentRefundsPayload {
  @Type(() => Number) @IsInt() @Min(1) @Max(24 * 365) hours: number;
}

export class ConfirmPaymentPayload extends IdPayload {
  // Vide pour une commande gratuite (aucun paiement Stripe).
  @IsString() @MaxLength(200) payment_intent_id: string;
  @Type(() => Number) @IsNumber() @Min(0) fees: number;
}

export class CancelOrderPayload extends IdPayload {
  @IsUUID() buyer_id: string;
  @IsOptional() @IsBoolean() is_admin?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class MarkRefundedPayload extends IdPayload {
  // false pour une revente : les places ne reviennent pas dans le stock.
  @IsOptional() @IsBoolean() restore_stock?: boolean;
}

export class PartialRefundPayload extends IdPayload {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount_ttc: number;
}

export class SetInvoiceUrlPayload extends IdPayload {
  @IsString() @MaxLength(1000) url: string;
}
