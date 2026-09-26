import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GiftTicketInput, RevertTransferInput, TicketTransferService } from './ticket-transfer.service';
import { RevertRequestStatus } from './transfer-revert-request.entity';

@Controller()
export class TicketTransferController {
  constructor(private readonly transfers: TicketTransferService) {}

  @MessagePattern('ticket.gift')
  gift(@Payload() data: GiftTicketInput) {
    return this.transfers.gift(data);
  }

  @MessagePattern('ticket.transfers_by_ticket')
  getByTicket(@Payload() data: { ticket_id: string }) {
    return this.transfers.getByTicket(data.ticket_id);
  }

  @MessagePattern('ticket.transfers_by_user')
  getByUser(@Payload() data: { user_id: string }) {
    return this.transfers.getByUser(data.user_id);
  }

  @MessagePattern('ticket.request_transfer_revert')
  requestRevert(@Payload() data: { transfer_id: string; user_id: string; reason: string }) {
    return this.transfers.requestRevert(data);
  }

  @MessagePattern('ticket.revert_transfer')
  revert(@Payload() data: RevertTransferInput) {
    return this.transfers.revert(data);
  }

  @MessagePattern('ticket.reject_transfer_revert')
  rejectRequest(@Payload() data: { request_id: string; admin_id: string; admin_email: string; reason: string }) {
    return this.transfers.rejectRequest(data);
  }

  @MessagePattern('ticket.list_transfer_revert_requests')
  listRevertRequests(@Payload() data: { status?: RevertRequestStatus; page?: number; limit?: number }) {
    return this.transfers.listRevertRequests(data ?? {});
  }

  @MessagePattern('ticket.transfer_revert_requests_by_user')
  getRequestsByUser(@Payload() data: { user_id: string }) {
    return this.transfers.getRequestsByUser(data.user_id);
  }

  @MessagePattern('ticket.list_transfers')
  list(@Payload() data: { q?: string; event_id?: string; page?: number; limit?: number }) {
    return this.transfers.list(data ?? {});
  }
}
