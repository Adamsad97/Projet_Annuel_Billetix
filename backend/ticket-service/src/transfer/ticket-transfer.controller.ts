import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TicketTransferService } from './ticket-transfer.service';
import { GiftTicketPayload, ListRevertRequestsPayload, ListTransfersPayload, RejectTransferRevertPayload, RequestTransferRevertPayload, RevertTransferPayload, TicketIdPayload, UserIdPayload } from '../common/payloads';

@Controller()
export class TicketTransferController {
  constructor(private readonly transfers: TicketTransferService) {}

  @MessagePattern('ticket.gift')
  gift(@Payload() data: GiftTicketPayload) {
    return this.transfers.gift(data);
  }

  @MessagePattern('ticket.transfers_by_ticket')
  getByTicket(@Payload() data: TicketIdPayload) {
    return this.transfers.getByTicket(data.ticket_id);
  }

  @MessagePattern('ticket.transfers_by_user')
  getByUser(@Payload() data: UserIdPayload) {
    return this.transfers.getByUser(data.user_id);
  }

  @MessagePattern('ticket.request_transfer_revert')
  requestRevert(@Payload() data: RequestTransferRevertPayload) {
    return this.transfers.requestRevert(data);
  }

  @MessagePattern('ticket.revert_transfer')
  revert(@Payload() data: RevertTransferPayload) {
    return this.transfers.revert(data);
  }

  @MessagePattern('ticket.reject_transfer_revert')
  rejectRequest(@Payload() data: RejectTransferRevertPayload) {
    return this.transfers.rejectRequest(data);
  }

  @MessagePattern('ticket.list_transfer_revert_requests')
  listRevertRequests(@Payload() data: ListRevertRequestsPayload) {
    return this.transfers.listRevertRequests(data ?? {});
  }

  @MessagePattern('ticket.transfer_revert_requests_by_user')
  getRequestsByUser(@Payload() data: UserIdPayload) {
    return this.transfers.getRequestsByUser(data.user_id);
  }

  @MessagePattern('ticket.list_transfers')
  list(@Payload() data: ListTransfersPayload) {
    return this.transfers.list(data ?? {});
  }
}
