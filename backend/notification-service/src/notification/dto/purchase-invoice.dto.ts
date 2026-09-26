import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

class PurchaseInvoiceItemDto {
  @IsString()
  categoryName: string;

  @IsString()
  quantity: string;

  @IsString()
  unitPriceTtc: string;

  @IsString()
  totalPriceTtc: string;
}

/** Email « facture » envoyé après paiement : détail complet de la commande + facture PDF jointe. */
export class PurchaseInvoiceDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  orderReference: string;

  @IsString()
  eventName: string;

  @IsString()
  eventDate: string;

  @IsString()
  eventVenue: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseInvoiceItemDto)
  items: PurchaseInvoiceItemDto[];

  @IsString()
  totalHt: string;

  @IsString()
  totalVat: string;

  @IsString()
  totalTtc: string;

  @IsString()
  @IsOptional()
  discount?: string;

  @IsString()
  @IsOptional()
  fees?: string;

  @IsString()
  paymentMethod: string;

  @IsString()
  paidAt: string;

  @IsString()
  billingName: string;

  @IsString()
  billingAddress: string;

  /** Identifiant de la commande (lien « Voir ma commande »). */
  @IsString()
  orderId: string;

  /**
   * Facture PDF encodée en base64, lue par l'api-gateway (bucket privé) —
   * absente si elle n'a pas pu être générée à temps.
   */
  @IsString()
  @IsOptional()
  invoicePdfBase64?: string;
}
