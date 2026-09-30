import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

/** Acheteur informé de l'issue de son litige. */
export class DisputeResolvedBuyerDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  eventName: string;

  @IsString()
  orderReference: string;

  /** WON : réclamation rejetée ; LOST : acheteur dans son droit ; CLOSED : clos sans suite. */
  @IsIn(['WON', 'LOST', 'CLOSED'])
  status: 'WON' | 'LOST' | 'CLOSED';

  @IsOptional()
  @IsString()
  resolutionNotes?: string | null;

  /** Montant remboursé, formaté (ex. « 45.00 »), si un remboursement accompagne la décision. */
  @IsOptional()
  @IsString()
  refundAmount?: string;
}
