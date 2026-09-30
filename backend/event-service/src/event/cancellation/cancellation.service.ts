import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, In, Repository } from 'typeorm';
import { Event, EventStatus } from '../event.entity';
import { EventService } from '../event.service';
import { CancellationMessage, CancellationMessageAuthor } from './cancellation-message.entity';
import { CancellationRequest, CancellationRequestStatus, ChangeRequestKind } from './cancellation-request.entity';

// Statuts dans lesquels l'événement peut encore être annulé.
const CANCELLABLE: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.PENDING_VALIDATION,
  EventStatus.PUBLISHED,
  EventStatus.SUSPENDED,
  EventStatus.POSTPONED,
];

const MESSAGE_MAX_LENGTH = 2000;

/**
 * Demandes d'annulation ou de report : l'organisateur demande, l'admin
 * accepte ou refuse. Annulation acceptée : événement annulé, la passerelle
 * rembourse les acheteurs. Report accepté : nouvelle date (ou « date à
 * venir »), les acheteurs sont prévenus et peuvent demander le
 * remboursement. Tant que la demande est en attente, les deux parties
 * échangent des messages pour trouver un accord.
 */
@Injectable()
export class CancellationService {
  constructor(
    @InjectRepository(CancellationRequest) private readonly requests: Repository<CancellationRequest>,
    @InjectRepository(CancellationMessage) private readonly messages: Repository<CancellationMessage>,
    @InjectRepository(Event) private readonly events: Repository<Event>,
    private readonly eventService: EventService,
    private readonly dataSource: DataSource,
  ) {}

  private cleanText(value: string | undefined, field: string): string {
    const text = (value ?? '').trim();
    if (!text) throw new RpcException({ statusCode: 400, message: `${field} est obligatoire.` });
    if (text.length > MESSAGE_MAX_LENGTH) {
      throw new RpcException({ statusCode: 400, message: `${field} ne doit pas dépasser ${MESSAGE_MAX_LENGTH} caractères.` });
    }
    return text;
  }

  private async load(id: string): Promise<CancellationRequest> {
    const request = isUUID(id)
      ? await this.requests.findOne({ where: { id }, relations: { messages: true }, order: { messages: { created_at: 'ASC' } } })
      : null;
    if (!request) throw new RpcException({ statusCode: 404, message: 'Demande introuvable.' });
    return request;
  }

  private assertPending(request: CancellationRequest): void {
    if (request.status !== CancellationRequestStatus.PENDING) {
      throw new RpcException({ statusCode: 409, message: 'Cette demande a déjà été traitée.' });
    }
  }

  /** L'organisateur demande l'annulation ou le report de son événement. */
  async request(
    eventId: string,
    organizerId: string,
    reason: string | undefined,
    options: { kind?: ChangeRequestKind; new_start_date?: string; new_end_date?: string } = {},
  ): Promise<CancellationRequest> {
    const kind = options.kind ?? ChangeRequestKind.CANCELLATION;
    const event = await this.eventService.getById(eventId);
    if (event.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: "Cet événement n'appartient pas à votre compte." });
    }
    let newDates: { start: Date; end: Date } | null = null;
    if (kind === ChangeRequestKind.POSTPONEMENT) {
      this.eventService.assertPostponable(event);
      newDates = this.eventService.parseNewDates(event, options.new_start_date, options.new_end_date);
    } else if (!CANCELLABLE.includes(event.status)) {
      throw new RpcException({ statusCode: 400, message: 'Cet événement ne peut plus être annulé.' });
    }
    const text = this.cleanText(reason, 'Le motif');
    const pending = await this.requests.findOne({
      where: { event_id: eventId, status: CancellationRequestStatus.PENDING },
    });
    if (pending) {
      throw new RpcException({
        statusCode: 409,
        message:
          pending.kind === ChangeRequestKind.POSTPONEMENT
            ? 'Une demande de report est déjà en cours pour cet événement.'
            : "Une demande d'annulation est déjà en cours pour cet événement.",
      });
    }
    const saved = await this.requests.save(
      this.requests.create({
        event_id: eventId,
        organizer_id: organizerId,
        reason: text,
        kind,
        new_start_date: newDates?.start ?? null,
        new_end_date: newDates?.end ?? null,
      }),
    );
    return this.load(saved.id);
  }

  /** Historique des demandes d'un événement (organisateur propriétaire ou admin). */
  async listByEvent(eventId: string, organizerId?: string): Promise<CancellationRequest[]> {
    if (organizerId) {
      const event = await this.eventService.getById(eventId);
      if (event.organizer_id !== organizerId) {
        throw new RpcException({ statusCode: 403, message: "Cet événement n'appartient pas à votre compte." });
      }
    }
    return this.requests.find({
      where: { event_id: eventId },
      relations: { messages: true },
      order: { created_at: 'DESC', messages: { created_at: 'ASC' } },
    });
  }

  async getById(id: string): Promise<CancellationRequest> {
    return this.load(id);
  }

  /** Liste admin, avec le titre de l'événement. */
  async listForAdmin(filters: {
    status?: CancellationRequestStatus;
    kind?: ChangeRequestKind;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Array<CancellationRequest & { event_title: string | null; event_start_date: Date | null }>; total: number }> {
    const [rows, total] = await this.requests.findAndCount({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
      },
      relations: { messages: true },
      order: { created_at: 'DESC', messages: { created_at: 'ASC' } },
      take: Math.min(filters.limit ?? 50, 100),
      skip: filters.offset ?? 0,
    });
    const events = rows.length ? await this.events.findBy({ id: In([...new Set(rows.map((row) => row.event_id))]) }) : [];
    const byId = new Map(events.map((event) => [event.id, event]));
    return {
      data: rows.map((row) => ({
        ...row,
        event_title: byId.get(row.event_id)?.title ?? null,
        event_start_date: byId.get(row.event_id)?.start_date ?? null,
      })),
      total,
    };
  }

  async countPending(): Promise<number> {
    return this.requests.count({ where: { status: CancellationRequestStatus.PENDING } });
  }

  /** Message dans l'échange (organisateur propriétaire ou admin). */
  async addMessage(
    requestId: string,
    authorId: string,
    authorRole: CancellationMessageAuthor,
    message: string | undefined,
  ): Promise<CancellationRequest> {
    const request = await this.load(requestId);
    if (authorRole === CancellationMessageAuthor.ORGANIZER && request.organizer_id !== authorId) {
      throw new RpcException({ statusCode: 403, message: "Cette demande n'appartient pas à votre compte." });
    }
    this.assertPending(request);
    const text = this.cleanText(message, 'Le message');
    await this.messages.save(
      this.messages.create({ request_id: request.id, author_id: authorId, author_role: authorRole, message: text }),
    );
    return this.load(request.id);
  }

  /** L'organisateur retire sa demande (l'événement continue normalement). */
  async withdraw(requestId: string, organizerId: string): Promise<CancellationRequest> {
    const request = await this.load(requestId);
    if (request.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: "Cette demande n'appartient pas à votre compte." });
    }
    this.assertPending(request);
    // update() ciblé : save() sur l'entité chargée avec ses messages
    // réécrirait aussi la relation.
    await this.requests.update(request.id, {
      status: CancellationRequestStatus.WITHDRAWN,
      decided_at: new Date(),
      decided_by: organizerId,
    });
    return this.load(request.id);
  }

  /** L'admin refuse : l'événement continue, le message explique pourquoi. */
  async reject(requestId: string, adminId: string, message: string | undefined): Promise<CancellationRequest> {
    const request = await this.load(requestId);
    this.assertPending(request);
    const text = this.cleanText(message, 'Le message');
    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        manager.create(CancellationMessage, {
          request_id: request.id,
          author_id: adminId,
          author_role: CancellationMessageAuthor.ADMIN,
          message: text,
        }),
      );
      await manager.update(CancellationRequest, request.id, {
        status: CancellationRequestStatus.REJECTED,
        decided_at: new Date(),
        decided_by: adminId,
      });
    });
    return this.load(request.id);
  }

  /**
   * L'admin accepte. Annulation : l'événement est annulé avec le motif de la
   * demande, la passerelle rembourse les acheteurs. Report : nouvelle date
   * appliquée (ou « date à venir »), la passerelle prévient les acheteurs.
   * previous_start_date : date annoncée juste avant le report.
   */
  async approve(
    requestId: string,
    adminId: string,
    message: string | undefined,
  ): Promise<{ request: CancellationRequest; event: Event; previous_start_date: Date }> {
    const request = await this.load(requestId);
    this.assertPending(request);
    const note = message?.trim() ? this.cleanText(message, 'Le message') : null;

    // D'abord la décision sur l'événement (peut échouer : déjà annulé,
    // déjà commencé…), puis la clôture de la demande et la note de l'admin.
    const before = await this.eventService.getById(request.event_id);
    const previousStart = before.start_date;
    const event =
      request.kind === ChangeRequestKind.POSTPONEMENT
        ? await this.eventService.postpone(
            request.event_id,
            request.reason,
            request.new_start_date && request.new_end_date
              ? { start: new Date(request.new_start_date), end: new Date(request.new_end_date) }
              : null,
          )
        : await this.eventService.cancel(request.event_id, adminId, { reason: request.reason }, true);
    await this.dataSource.transaction(async (manager) => {
      if (note) {
        await manager.save(
          manager.create(CancellationMessage, {
            request_id: request.id,
            author_id: adminId,
            author_role: CancellationMessageAuthor.ADMIN,
            message: note,
          }),
        );
      }
      await manager.update(CancellationRequest, request.id, {
        status: CancellationRequestStatus.APPROVED,
        decided_at: new Date(),
        decided_by: adminId,
      });
    });
    return { request: await this.load(request.id), event, previous_start_date: previousStart };
  }
}
