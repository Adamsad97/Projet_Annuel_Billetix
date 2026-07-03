import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../ticket/ticket.entity';
import { TicketService } from '../ticket/ticket.service';
import { ScanLog, ScanResult } from './scan-log.entity';

export interface ScanDto {
  qr_token: string;
  agent_id: string;
  event_id: string;
  device_info?: string;
  is_offline?: boolean;
  scanned_at?: string;
}

export interface ScanResponse {
  result: ScanResult;
  ticket_id: string;
  // Renseigné uniquement si result === SUCCESS — utilisé par l'api-gateway pour le push WS
  ticket?: Ticket;
}

@Injectable()
export class ScanService {
  constructor(
    @InjectRepository(ScanLog) private readonly logRepo: Repository<ScanLog>,
    private readonly ticketService: TicketService,
  ) {}

  async scan(dto: ScanDto): Promise<ScanResponse> {
    const scannedAt = dto.scanned_at ? new Date(dto.scanned_at) : new Date();

    let ticketId: string;
    let result: ScanResult;
    let scannedTicket: Ticket | undefined;

    try {
      const { ticket } = await this.ticketService.verifyQr(dto.qr_token);
      ticketId = ticket.id;

      if (ticket.event_id !== dto.event_id) {
        result = ScanResult.INVALID;
      } else {
        scannedTicket = await this.ticketService.markUsed(ticket.id, dto.agent_id, dto.device_info);
        result = ScanResult.SUCCESS;
      }
    } catch (err: any) {
      const message = err?.error?.message ?? '';
      if (message.includes('déjà utilisé')) {
        result = ScanResult.ALREADY_USED;
        const existing = await this.logRepo.findOne({
          where: { event_id: dto.event_id },
          order: { created_at: 'DESC' },
        });
        ticketId = existing?.ticket_id ?? 'unknown';
      } else if (message.includes('annulé') || message.includes('remboursé')) {
        result = ScanResult.CANCELLED;
        ticketId = 'unknown';
      } else {
        result = ScanResult.INVALID;
        ticketId = 'unknown';
      }
    }

    await this.logRepo.save(
      this.logRepo.create({
        ticket_id: ticketId,
        agent_id: dto.agent_id,
        event_id: dto.event_id,
        scanned_at: scannedAt,
        result,
        device_info: dto.device_info ?? null,
        is_offline: dto.is_offline ?? false,
      }),
    );

    return { result, ticket_id: ticketId, ticket: scannedTicket };
  }

  async getLogsByEvent(eventId: string): Promise<ScanLog[]> {
    return this.logRepo.find({
      where: { event_id: eventId },
      order: { scanned_at: 'DESC' },
    });
  }
}
