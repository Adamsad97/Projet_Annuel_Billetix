import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { ControlAgentService } from '../control-agent/control-agent.service';
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
  // true si agent_id est l'organisateur de l'événement (vérifié côté
  // gateway) — dans ce cas, pas d'affectation ControlAgent à vérifier.
  is_organizer?: boolean;
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
    private readonly controlAgentService: ControlAgentService,
  ) {}

  async scan(dto: ScanDto): Promise<ScanResponse> {
    // Bug corrigé : n'importe quel utilisateur avec le rôle global AGENT
    // pouvait scanner les billets de N'IMPORTE QUEL événement, y compris un
    // événement dont il n'a jamais été l'agent assigné (ou dont il vient
    // d'être révoqué via ticket.remove_agent) — le rôle JWT était vérifié,
    // mais jamais l'affectation réelle à CET événement (CDC §6.2).
    if (!dto.is_organizer) {
      const isAssigned = await this.controlAgentService.isAssigned(dto.agent_id, dto.event_id);
      if (!isAssigned) {
        throw new RpcException({
          statusCode: 403,
          message: "Agent non assigné à cet événement (ou révoqué)",
        });
      }
    }

    const scannedAt = dto.scanned_at ? new Date(dto.scanned_at) : new Date();

    let ticketId = 'unknown';
    let result: ScanResult;
    let scannedTicket: Ticket | undefined;

    try {
      // Recalcul cryptographique en premier : identifie le billet visé même
      // si le scan échoue ensuite (déjà utilisé/annulé) — avant, un double
      // scan reprenait par erreur le tout dernier log de l'événement, pas
      // forcément le billet réellement présenté.
      const { ticketId: resolvedId } = this.ticketService.parseQrToken(dto.qr_token);
      ticketId = resolvedId;

      const { ticket } = await this.ticketService.verifyQr(dto.qr_token);

      if (ticket.event_id !== dto.event_id) {
        result = ScanResult.WRONG_EVENT;
      } else {
        scannedTicket = await this.ticketService.markUsed(ticket.id, dto.agent_id, dto.device_info);
        result = ScanResult.SUCCESS;
      }
    } catch (scanError: any) {
      const code = scanError?.error?.code;
      if (code === 'ALREADY_USED') {
        result = ScanResult.ALREADY_USED;
      } else if (code === 'CANCELLED') {
        result = ScanResult.CANCELLED;
      } else {
        result = ScanResult.INVALID;
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
