import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { KycStatus } from '../organizer-profile.entity';

export class UpdateKycDto {
  @IsEnum(KycStatus)
  kyc_status: KycStatus;

  @IsString()
  @IsOptional()
  kyc_rejected_reason?: string;

  // require_tld: false — document hébergé sur MinIO, localhost en dev.
  @IsUrl({ require_tld: false })
  @IsOptional()
  kyc_document_url?: string;
}
