import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { IdPayload } from '../common/payloads';
import { CreateVatRatePayload, UpdateVatRatePayload } from './dto/vat-rate.payloads';
import { VatRateService } from './vat-rate.service';

@Controller()
export class VatRateController {
  constructor(private readonly vatRateService: VatRateService) {}

  @MessagePattern('event.vat_rate.list')
  listActive() {
    return this.vatRateService.listActive();
  }

  @MessagePattern('event.vat_rate.list_all')
  listAll() {
    return this.vatRateService.listAll();
  }

  @MessagePattern('event.vat_rate.create')
  create(@Payload() data: CreateVatRatePayload) {
    return this.vatRateService.create(data.dto);
  }

  @MessagePattern('event.vat_rate.update')
  update(@Payload() data: UpdateVatRatePayload) {
    return this.vatRateService.update(data.id, data.dto);
  }

  @MessagePattern('event.vat_rate.delete')
  remove(@Payload() data: IdPayload) {
    return this.vatRateService.remove(data.id);
  }
}
