import { PayoutMethod } from '../organizer/organizer-profile.entity';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { UpdateBuyerProfileDto } from '../buyer/dto/update-buyer-profile.dto';
import { UpdateNotificationPrefsDto } from '../buyer/dto/update-notification-prefs.dto';
import { CreateOrganizerProfileDto } from '../organizer/dto/create-organizer-profile.dto';
import { UpdateIbanDto } from '../organizer/dto/update-iban.dto';
import { UpdateKycDto } from '../organizer/dto/update-kyc.dto';
import { UpdateOrganizerProfileDto } from '../organizer/dto/update-organizer-profile.dto';

/**
 * Messages internes de user-service (TCP entre services) : le compte visé
 * est vérifié ici, et chaque formulaire (dto) est validé en profondeur.
 */
export class UserIdPayload {
  @IsUUID() user_id: string;
}

export class UpdateBuyerProfilePayload extends UserIdPayload {
  @ValidateNested() @Type(() => UpdateBuyerProfileDto) dto: UpdateBuyerProfileDto;
}

export class UpdateNotificationPrefsPayload extends UserIdPayload {
  @ValidateNested() @Type(() => UpdateNotificationPrefsDto) dto: UpdateNotificationPrefsDto;
}

export class CreateOrganizerProfilePayload extends UserIdPayload {
  @ValidateNested() @Type(() => CreateOrganizerProfileDto) dto: CreateOrganizerProfileDto;
}

export class UpdateOrganizerProfilePayload extends UserIdPayload {
  @ValidateNested() @Type(() => UpdateOrganizerProfileDto) dto: UpdateOrganizerProfileDto;
}

export class UpdateIbanPayload extends UserIdPayload {
  @ValidateNested() @Type(() => UpdateIbanDto) dto: UpdateIbanDto;
}

export class SetPayoutMethodPayload extends UserIdPayload {
  @IsEnum(PayoutMethod) payout_method: PayoutMethod;
}

export class UpdateKycPayload extends UserIdPayload {
  @ValidateNested() @Type(() => UpdateKycDto) dto: UpdateKycDto;
}

// Identifiant de compte Stripe Connect (acct_…).
const STRIPE_ACCOUNT = /^acct_[A-Za-z0-9]{6,64}$/;

export class SetStripeAccountPayload extends UserIdPayload {
  @IsString() @Matches(STRIPE_ACCOUNT, { message: 'Identifiant de compte Stripe invalide.' }) account_id: string;
}

export class StripeOnboardedPayload {
  @IsString() @Matches(STRIPE_ACCOUNT, { message: 'Identifiant de compte Stripe invalide.' }) account_id: string;
  @IsBoolean() onboarded: boolean;
}
