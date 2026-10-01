import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdPayload } from '../../common/payloads';
import { CreateVatRateDto, UpdateVatRateDto } from './vat-rate.dto';

export class CreateVatRatePayload {
  @ValidateNested() @Type(() => CreateVatRateDto) dto: CreateVatRateDto;
}

export class UpdateVatRatePayload extends IdPayload {
  @ValidateNested() @Type(() => UpdateVatRateDto) dto: UpdateVatRateDto;
}
