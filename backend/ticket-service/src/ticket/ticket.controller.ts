import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GenerateTicketsDto } from './dto/generate-tickets.dto';
import { TicketService } from './ticket.service';

@Controller()
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @MessagePattern('ticket.generate')
  generate(@Payload() dto: GenerateTicketsDto) {
    return this.ticketService.generate(dto);
  }

  @MessagePattern('ticket.get')
  getById(@Payload() data: { id: string }) {
    return this.ticketService.getById(data.id);
  }

  @MessagePattern('ticket.get_by_order')
  getByOrder(@Payload() data: { order_id: string }) {
    return this.ticketService.getByOrder(data.order_id);
  }

  @MessagePattern('ticket.verify_qr')
  verifyQr(@Payload() data: { token: string }) {
    return this.ticketService.verifyQr(data.token);
  }

  @MessagePattern('ticket.mark_sent')
  markSent(@Payload() data: { order_id: string }) {
    return this.ticketService.markSent(data.order_id);
  }

  @MessagePattern('ticket.mark_used')
  markUsed(@Payload() data: { id: string; agent_id: string; device_info?: string }) {
    return this.ticketService.markUsed(data.id, data.agent_id, data.device_info);
  }

  @MessagePattern('ticket.cancel')
  cancel(@Payload() data: { id: string }) {
    return this.ticketService.cancel(data.id);
  }

  @MessagePattern('ticket.invalidate')
  invalidate(@Payload() data: { id: string; admin_id: string; reason: string }) {
    return this.ticketService.invalidate(data.id, data.admin_id, data.reason);
  }

  @MessagePattern('ticket.set_pdf_url')
  setPdfUrl(@Payload() data: { id: string; url: string }) {
    return this.ticketService.setPdfUrl(data.id, data.url);
  }
}
