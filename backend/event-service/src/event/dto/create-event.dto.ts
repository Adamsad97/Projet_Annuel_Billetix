import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { RefundPolicy } from '../event.entity';

export class CreateEventDto {
  @IsString() @MinLength(5) @MaxLength(120)
  title: string;

  @IsString() @MinLength(10)
  description: string;

  // Le format est vérifié ici, l'existence/l'activation réelle du code est
  // vérifiée dans EventService.create/update via CategoryService.assertActive
  // (liste gérée depuis l'espace Admin, pas un enum figé).
  @IsString() @IsNotEmpty()
  category: string;

  @IsBoolean() @IsOptional()
  is_non_profit?: boolean;

  // Bug corrigé : justificatif optionnel même en cas de déclaration "à but
  // non lucratif" — sans lui, l'admin n'a rien à vérifier avant d'accorder
  // l'exonération de commission (cf. EventService.computeCommissionRate).
  @ValidateIf((dto: CreateEventDto) => dto.is_non_profit === true)
  @IsUrl({ require_tld: false }, { message: 'Un justificatif est requis pour une déclaration à but non lucratif' })
  non_profit_document_url?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsString() @IsOptional()
  timezone?: string;

  @IsString()
  venue_name: string;

  @IsString()
  venue_address_line1: string;

  @IsString() @IsOptional()
  venue_address_line2?: string;

  @IsString()
  venue_city: string;

  @IsString()
  venue_postal_code: string;

  @IsString()
  venue_country: string;

  @IsOptional()
  venue_latitude?: number;

  @IsOptional()
  venue_longitude?: number;

  // require_tld: false — même correctif que non_profit_document_url ci-dessus.
  @IsUrl({ require_tld: false })
  poster_url: string;

  @IsInt() @Min(1)
  total_capacity: number;

  @IsDateString()
  sales_start_date: string;

  @IsDateString()
  sales_end_date: string;

  @IsEnum(RefundPolicy)
  refund_policy: RefundPolicy;

  @IsInt() @Min(1) @IsOptional()
  refund_deadline_days?: number;

  @IsString() @IsOptional()
  access_conditions?: string;
}
