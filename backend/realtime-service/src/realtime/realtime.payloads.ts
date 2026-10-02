import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

/** Billet scanné à l'entrée : prévient son titulaire en direct. */
export class TicketScannedEvent {
  @IsUUID() holder_id: string;
  @IsUUID() ticket_id: string;
  @IsString() event_name: string;
  @IsString() ticket_category_name: string;
  @IsString() scanned_at: string;
}

/** Vente ou entrée sur un événement : le tableau de bord ouvert se rafraîchit. */
export class DashboardChangedEvent {
  @IsUUID() event_id: string;
  @IsIn(['sale', 'scan']) reason: 'sale' | 'scan';
}

class AdminAlertData {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) count?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) threshold?: number;
  @IsOptional() @IsString() ticket_id?: string;
  @IsOptional() @IsString() event_id?: string;
}

/** Seuil d'alerte franchi (remboursements, litiges, double scan) : prévient les admins connectés. */
export class AdminAlertEvent {
  @IsIn(['mass_refunds', 'dispute_spike', 'duplicate_scan']) type: 'mass_refunds' | 'dispute_spike' | 'duplicate_scan';
  @IsIn(['warning', 'critical']) severity: 'warning' | 'critical';
  @ValidateNested() @Type(() => AdminAlertData) data: AdminAlertData;
}

export class DashboardSubscription {
  @IsUUID() event_id: string;
}
