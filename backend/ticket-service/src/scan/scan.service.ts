import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
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

/** Statuts d'événement autorisant l'entrée (TERMINATED : juste après la fin, dans la fenêtre de fermeture). */
const OPEN_EVENT_STATUSES = ['PUBLISHED', 'TERMINATED'];
const EVENT_LOOKUP_TIMEOUT_MS = 3000;

interface EventSnapshot {
  status: string;
  is_hidden?: boolean;
  start_date: string;
  end_date: string | null;
}

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    @InjectRepository(ScanLog) private readonly logRepo: Repository<ScanLog>,
    private readonly ticketService: TicketService,
    private readonly controlAgentService: ControlAgentService,
    private readonly platformConfig: PlatformConfigCache,
    @Inject('EVENT_SERVICE') private readonly eventClient: ClientProxy,
  ) {}

  /** Événement ouvert et dans la fenêtre de contrôle ; si event-service est injoignable, on juge sur les dates du billet. */
  private async eventGate(ticket: Ticket, at: Date): Promise<ScanResult | null> {
    const event = await firstValueFrom(
      this.eventClient.send<EventSnapshot>('event.get', { id: ticket.event_id }).pipe(timeout(EVENT_LOOKUP_TIMEOUT_MS)),
    ).catch((err) => {
      this.logger.warn(`Statut de l'événement ${ticket.event_id} indisponible au scan : ${err?.message ?? err}`);
      return null;
    });

    if (event && (event.is_hidden || !OPEN_EVENT_STATUSES.includes(event.status))) {
      return ScanResult.EVENT_UNAVAILABLE;
    }

    const { scan_opens_before_minutes: before, scan_closes_after_minutes: after } = await this.platformConfig.get();
    const start = new Date(event?.start_date ?? ticket.event_start_at).getTime();
    const end = new Date(event?.end_date ?? ticket.event_end_at ?? ticket.event_start_at).getTime();
    if (at.getTime() < start - before * 60_000) return ScanResult.TOO_EARLY;
    if (at.getTime() > end + after * 60_000) return ScanResult.TOO_LATE;
    return null;
  }

  /** Paquet hors ligne pour vérifier un QR sans réseau, réservé à l'organisateur et aux agents affectés. */
  async getOfflinePack(eventId: string, requesterId: string, isOrganizer: boolean) {
    await this.assertCanControl(eventId, requesterId, isOrganizer);
    const [pack, event, config] = await Promise.all([
      this.ticketService.getOfflinePack(eventId),
      firstValueFrom(
        this.eventClient
          .send<EventSnapshot & { timezone?: string }>('event.get', { id: eventId })
          .pipe(timeout(EVENT_LOOKUP_TIMEOUT_MS)),
      ),
      this.platformConfig.get(),
    ]);
    return {
      ...pack,
      event: {
        id: eventId,
        status: event.status,
        is_hidden: event.is_hidden ?? false,
        start_date: event.start_date,
        end_date: event.end_date,
        timezone: event.timezone ?? null,
      },
      scan_opens_before_minutes: config.scan_opens_before_minutes,
      scan_closes_after_minutes: config.scan_closes_after_minutes,
    };
  }

  /** Entrées de l'événement, tous agents confondus (écran de scan). */
  async getEntryStats(eventId: string, requesterId: string, isOrganizer: boolean) {
    await this.assertCanControl(eventId, requesterId, isOrganizer);
    return this.ticketService.getEntryStats(eventId);
  }

  /** Organisateur de l'événement (vérifié par la passerelle) ou agent affecté. */
  private async assertCanControl(eventId: string, requesterId: string, isOrganizer: boolean): Promise<void> {
    if (!isOrganizer && !(await this.controlAgentService.isAssigned(requesterId, eventId))) {
      throw new RpcException({ statusCode: 403, message: 'Agent non assigné à cet événement (ou révoqué)' });
    }
  }

  async scan(dto: ScanDto): Promise<ScanResponse> {
    // CDC §6.2 : un agent ne scanne que les événements auxquels il est affecté.
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
      // Identifie d'abord le billet visé, même si le scan échoue ensuite.
      ticketId = await this.ticketService.resolveTicketId(dto.qr_token);

      const { ticket } = await this.ticketService.verifyQr(dto.qr_token, scannedAt);

      if (ticket.event_id !== dto.event_id) {
        result = ScanResult.WRONG_EVENT;
      } else {
        const refusal = await this.eventGate(ticket, scannedAt);
        if (refusal) {
          result = refusal;
        } else {
          scannedTicket = await this.ticketService.markUsed(ticket.id, dto.agent_id, dto.device_info, ticket.qr_code_token);
          result = ScanResult.SUCCESS;
        }
      }
    } catch (scanError: any) {
      const code = scanError?.error?.code;
      if (code === 'ALREADY_USED') {
        result = ScanResult.ALREADY_USED;
      } else if (code === 'CANCELLED') {
        result = ScanResult.CANCELLED;
      } else if (code === 'SUPERSEDED') {
        result = ScanResult.SUPERSEDED;
      } else if (code === 'EXPIRED') {
        result = ScanResult.EXPIRED;
      } else if (code === 'STATIC_REFUSED') {
        result = ScanResult.STATIC_REFUSED;
      } else if (code === 'FOR_RESALE') {
        result = ScanResult.FOR_RESALE;
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
    if (!dto.is_organizer) {
      await this.controlAgentService.recordActivity(dto.agent_id, dto.event_id, scannedAt);
    }

    return { result, ticket_id: ticketId, ticket: scannedTicket };
  }

  async getLogsByEvent(eventId: string): Promise<ScanLog[]> {
    return this.logRepo.find({
      where: { event_id: eventId },
      order: { scanned_at: 'DESC' },
    });
  }
}
