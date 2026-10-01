import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Avoir d'une commande remboursée (tout ou partie de sa facture). */
export class CreditNotePdfDto {
  @IsUUID()
  credit_note_id: string;

  /** Numéro de l'avoir (AV-2026-00001). */
  @IsString()
  number: string;

  @IsDateString()
  issued_at: string;

  /** Facture annulée : référence de la commande. */
  @IsString()
  invoice_reference: string;

  @IsString()
  reason: string;

  @IsString()
  event_name: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  tva_rate: number;

  @IsString()
  billing_first_name: string;

  @IsString()
  billing_last_name: string;

  @IsOptional()
  @IsString()
  billing_address_line1?: string | null;

  @IsOptional()
  @IsString()
  billing_address_line2?: string | null;

  @IsOptional()
  @IsString()
  billing_city?: string | null;

  @IsOptional()
  @IsString()
  billing_postal_code?: string | null;

  @IsOptional()
  @IsString()
  billing_country?: string | null;

  @IsNumber()
  @Min(0)
  amount_ht: number;

  @IsNumber()
  tva_amount: number;

  @IsNumber()
  @Min(0)
  fees_amount: number;

  @IsNumber()
  @Min(0)
  amount_ttc: number;

  @IsString()
  platform_legal_name: string;

  @IsString()
  platform_siret: string;

  @IsString()
  platform_vat_number: string;

  @IsString()
  platform_address: string;
}
