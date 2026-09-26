import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { QrTokenHistory } from '../ticket/qr-token-history.entity';
import { Ticket, TicketStatus } from '../ticket/ticket.entity';
import { newOpaqueToken } from '../ticket/ticket.service';
import { TicketTransfer, TicketTransferStatus, TransferRevertSource } from './ticket-transfer.entity';
import { RevertRequestStatus, TransferRevertRequest } from './transfer-revert-request.entity';

export interface GiftTicketInput {
  ticket_id: string;
  from_user_id: string;
  from_first_name: string;
  from_last_name: string;
  to_user_id: string;
  to_email: string;
  to_holder_first_name: string;
  to_holder_last_name: string;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface RevertTransferInput {
  transfer_id: string;
  admin_id: string;
  admin_email: string;
  reason: string;
  source: TransferRevertSource;
  // Demande de l'expéditeur traitée par cette annulation (source PLATFORM).
  request_id?: string;
}

/**
 * « Offrir mon billet » : transfert gratuit et immédiat à un autre compte
 * BilleTix, sans acceptation. Pour revendre un billet, on passe par la
 * revente (prix plafonné) — jamais par ce transfert.
 */
@Injectable()
export class TicketTransferService {
  constructor(
    @InjectRepository(TicketTransfer) private readonly repo: Repository<TicketTransfer>,
    @InjectRepository(TransferRevertRequest)
    private readonly requestRepo: Repository<TransferRevertRequest>,
    private readonly dataSource: DataSource,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async gift(input: GiftTicketInput): Promise<{ ticket: Ticket; transfer: TicketTransfer }> {
    if (input.to_user_id === input.from_user_id) {
      throw new RpcException({ statusCode: 400, message: 'Vous êtes déjà titulaire de ce billet.' });
    }
    const config = await this.platformConfig.get();

    return this.dataSource.transaction(async (manager) => {
      // Verrou sur la ligne du billet : deux transferts (ou un transfert et
      // une mise en revente) simultanés ne peuvent pas passer tous les deux.
      const ticket = await manager.findOne(Ticket, {
        where: { id: input.ticket_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!ticket) throw new RpcException({ statusCode: 404, message: 'Billet introuvable' });
      if (ticket.buyer_id !== input.from_user_id) {
        throw new RpcException({ statusCode: 403, message: 'Ce billet ne vous appartient pas' });
      }
      if (ticket.status === TicketStatus.FOR_RESALE) {
        throw new RpcException({
          statusCode: 409,
          message: 'Ce billet est en revente : retirez-le de la revente avant de l\'offrir.',
        });
      }
      if (ticket.status !== TicketStatus.GENERATED && ticket.status !== TicketStatus.SENT) {
        throw new RpcException({ statusCode: 409, message: 'Ce billet n\'est plus utilisable : il ne peut pas être offert.' });
      }

      const cutoff = new Date(
        new Date(ticket.event_start_at).getTime() - config.ticket_transfer_cutoff_hours * 3600_000,
      );
      if (new Date() >= cutoff) {
        throw new RpcException({
          statusCode: 409,
          message: `Les transferts ferment ${config.ticket_transfer_cutoff_hours} h avant le début de l'événement.`,
        });
      }

      // Un transfert annulé par un admin ne compte pas dans la limite.
      const previousTransfers = await manager.count(TicketTransfer, {
        where: { ticket_id: ticket.id, status: Not(TicketTransferStatus.REVERTED) },
      });
      if (previousTransfers >= config.ticket_transfer_max_per_ticket) {
        throw new RpcException({
          statusCode: 409,
          message:
            config.ticket_transfer_max_per_ticket === 0
              ? 'Le transfert de billets est désactivé sur la plateforme.'
              : `Ce billet a déjà été transféré le nombre maximum de fois autorisé (${config.ticket_transfer_max_per_ticket}).`,
        });
      }

      const transfer = await manager.save(
        manager.create(TicketTransfer, {
          ticket_id: ticket.id,
          ticket_reference: ticket.reference,
          event_id: ticket.event_id,
          event_name: ticket.event_name,
          event_start_at: ticket.event_start_at,
          ticket_category_name: ticket.ticket_category_name,
          from_user_id: ticket.buyer_id,
          from_email: ticket.buyer_email,
          from_first_name: input.from_first_name,
          from_last_name: input.from_last_name,
          from_holder_first_name: ticket.holder_first_name,
          from_holder_last_name: ticket.holder_last_name,
          to_user_id: input.to_user_id,
          to_email: input.to_email,
          to_holder_first_name: input.to_holder_first_name.trim(),
          to_holder_last_name: input.to_holder_last_name.trim(),
          ip_address: input.ip_address ?? null,
          user_agent: input.user_agent ?? null,
        }),
      );

      const saved = await this.reassign(manager, ticket, {
        buyer_id: input.to_user_id,
        buyer_email: input.to_email,
        holder_first_name: transfer.to_holder_first_name,
        holder_last_name: transfer.to_holder_last_name,
      });
      return { ticket: saved, transfer };
    });
  }

  /**
   * Change le titulaire d'un billet avec un nouveau jeton interne : tout QR
   * affiché par l'ancien titulaire devient SUPERSEDED au contrôle (l'ancien
   * jeton reste dans l'historique).
   */
  private async reassign(
    manager: EntityManager,
    ticket: Ticket,
    holder: { buyer_id: string; buyer_email: string; holder_first_name: string; holder_last_name: string },
  ): Promise<Ticket> {
    await manager.update(QrTokenHistory, { token: ticket.qr_code_token }, { is_current: false });
    const newToken = newOpaqueToken();
    await manager.save(manager.create(QrTokenHistory, { token: newToken, ticket_id: ticket.id, is_current: true }));
    Object.assign(ticket, holder);
    ticket.qr_code_token = newToken;
    return manager.save(ticket);
  }

  /**
   * Conditions communes à une demande et à une annulation : transfert
   * encore actif, billet toujours chez le bénéficiaire, pas utilisé, pas en
   * revente, événement pas encore commencé.
   */
  private assertRevertible(transfer: TicketTransfer, ticket: Ticket | null): asserts ticket is Ticket {
    if (transfer.status === TicketTransferStatus.REVERTED) {
      throw new RpcException({ statusCode: 409, message: 'Ce transfert a déjà été annulé.' });
    }
    if (!ticket) throw new RpcException({ statusCode: 404, message: 'Billet introuvable' });
    if (ticket.buyer_id !== transfer.to_user_id) {
      throw new RpcException({
        statusCode: 409,
        message: 'Le billet a changé de titulaire depuis ce transfert : il ne peut plus être annulé.',
      });
    }
    if (ticket.status === TicketStatus.FOR_RESALE) {
      throw new RpcException({
        statusCode: 409,
        message: 'Le bénéficiaire a mis ce billet en revente : l\'annonce doit d\'abord être retirée.',
      });
    }
    if (ticket.status !== TicketStatus.GENERATED && ticket.status !== TicketStatus.SENT) {
      throw new RpcException({
        statusCode: 409,
        message: 'Ce billet a déjà été utilisé ou annulé : le transfert ne peut plus être annulé.',
      });
    }
    if (new Date(ticket.event_start_at).getTime() <= Date.now()) {
      throw new RpcException({ statusCode: 409, message: 'L\'événement a commencé : le transfert ne peut plus être annulé.' });
    }
  }

  /** L'expéditeur demande l'annulation depuis la plateforme (traitée par un admin). */
  async requestRevert(data: { transfer_id: string; user_id: string; reason: string }): Promise<TransferRevertRequest> {
    const transfer = await this.repo.findOne({ where: { id: data.transfer_id } });
    if (!transfer) throw new RpcException({ statusCode: 404, message: 'Transfert introuvable' });
    if (transfer.from_user_id !== data.user_id) {
      throw new RpcException({ statusCode: 403, message: 'Seul l\'expéditeur peut demander l\'annulation de ce transfert.' });
    }
    const ticket = await this.dataSource.getRepository(Ticket).findOne({ where: { id: transfer.ticket_id } });
    this.assertRevertible(transfer, ticket);

    const pending = await this.requestRepo.findOne({
      where: { transfer_id: transfer.id, status: RevertRequestStatus.PENDING },
    });
    if (pending) {
      throw new RpcException({ statusCode: 409, message: 'Une demande d\'annulation est déjà en cours de traitement.' });
    }
    return this.requestRepo.save(
      this.requestRepo.create({
        transfer_id: transfer.id,
        ticket_id: transfer.ticket_id,
        requested_by: data.user_id,
        reason: data.reason.trim(),
      }),
    );
  }

  /**
   * Annulation par un admin (demande par téléphone ou depuis la plateforme) :
   * le billet revient à l'expéditeur, au nom de son titulaire d'origine.
   */
  async revert(input: RevertTransferInput): Promise<{ ticket: Ticket; transfer: TicketTransfer }> {
    return this.dataSource.transaction(async (manager) => {
      const transfer = await manager.findOne(TicketTransfer, {
        where: { id: input.transfer_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) throw new RpcException({ statusCode: 404, message: 'Transfert introuvable' });
      const ticket = await manager.findOne(Ticket, {
        where: { id: transfer.ticket_id },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertRevertible(transfer, ticket);

      const saved = await this.reassign(manager, ticket, {
        buyer_id: transfer.from_user_id,
        buyer_email: transfer.from_email,
        holder_first_name: transfer.from_holder_first_name,
        holder_last_name: transfer.from_holder_last_name,
      });

      transfer.status = TicketTransferStatus.REVERTED;
      transfer.reverted_at = new Date();
      transfer.reverted_by = input.admin_id;
      transfer.reverted_by_email = input.admin_email;
      transfer.revert_reason = input.reason.trim();
      transfer.revert_source = input.source;
      const reverted = await manager.save(transfer);

      // Toute demande en attente sur ce transfert est de fait acceptée.
      await manager.update(
        TransferRevertRequest,
        { transfer_id: transfer.id, status: RevertRequestStatus.PENDING },
        {
          status: RevertRequestStatus.APPROVED,
          decided_by: input.admin_id,
          decided_by_email: input.admin_email,
          decision_reason: input.reason.trim(),
          decided_at: new Date(),
        },
      );
      return { ticket: saved, transfer: reverted };
    });
  }

  /** Un admin refuse la demande de l'expéditeur : le transfert reste acquis. */
  async rejectRequest(data: {
    request_id: string;
    admin_id: string;
    admin_email: string;
    reason: string;
  }): Promise<{ request: TransferRevertRequest; transfer: TicketTransfer }> {
    const request = await this.requestRepo.findOne({ where: { id: data.request_id } });
    if (!request) throw new RpcException({ statusCode: 404, message: 'Demande introuvable' });
    if (request.status !== RevertRequestStatus.PENDING) {
      throw new RpcException({ statusCode: 409, message: 'Cette demande a déjà été traitée.' });
    }
    request.status = RevertRequestStatus.REJECTED;
    request.decided_by = data.admin_id;
    request.decided_by_email = data.admin_email;
    request.decision_reason = data.reason.trim();
    request.decided_at = new Date();
    const saved = await this.requestRepo.save(request);
    const transfer = await this.repo.findOneOrFail({ where: { id: request.transfer_id } });
    return { request: saved, transfer };
  }

  /** Demandes d'annulation, avec le transfert concerné (file de l'admin). */
  async listRevertRequests(filters: { status?: RevertRequestStatus; page?: number; limit?: number }) {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const page = Math.max(filters.page ?? 1, 1);
    const [requests, total] = await this.requestRepo.findAndCount({
      where: filters.status ? { status: filters.status } : {},
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const transfers = requests.length
      ? await this.repo.findBy({ id: In(requests.map((request) => request.transfer_id)) })
      : [];
    const byId = new Map(transfers.map((transfer) => [transfer.id, transfer]));
    return {
      data: requests.map((request) => ({ ...request, transfer: byId.get(request.transfer_id) ?? null })),
      total,
      page,
      limit,
    };
  }

  /** Demandes d'annulation faites par un utilisateur (suivi côté expéditeur). */
  getRequestsByUser(userId: string): Promise<TransferRevertRequest[]> {
    return this.requestRepo.find({ where: { requested_by: userId }, order: { created_at: 'DESC' } });
  }

  /** Chaîne des titulaires d'un billet, du plus ancien transfert au plus récent. */
  getByTicket(ticketId: string): Promise<TicketTransfer[]> {
    return this.repo.find({ where: { ticket_id: ticketId }, order: { created_at: 'ASC' } });
  }

  /** Transferts où l'utilisateur est expéditeur ou bénéficiaire (son historique). */
  getByUser(userId: string): Promise<TicketTransfer[]> {
    return this.repo.find({
      where: [{ from_user_id: userId }, { to_user_id: userId }],
      order: { created_at: 'DESC' },
    });
  }

  /** Vue administration : tous les transferts, filtrables par référence, email ou événement. */
  async list(filters: { q?: string; event_id?: string; page?: number; limit?: number }) {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const page = Math.max(filters.page ?? 1, 1);
    const qb = this.repo.createQueryBuilder('t').orderBy('t.created_at', 'DESC');
    if (filters.event_id) qb.andWhere('t.event_id = :eventId', { eventId: filters.event_id });
    if (filters.q) {
      qb.andWhere(
        `(LOWER(t.ticket_reference) LIKE :q OR LOWER(t.event_name) LIKE :q
          OR LOWER(t.from_email) LIKE :q OR LOWER(t.to_email) LIKE :q
          OR LOWER(t.from_first_name || ' ' || t.from_last_name) LIKE :q
          OR LOWER(t.from_holder_first_name || ' ' || t.from_holder_last_name) LIKE :q
          OR LOWER(t.to_holder_first_name || ' ' || t.to_holder_last_name) LIKE :q)`,
        { q: `%${filters.q.trim().toLowerCase()}%` },
      );
    }
    const [transfers, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    // Demande de l'expéditeur en attente : signalée à l'admin sur la ligne.
    const pending = transfers.length
      ? await this.requestRepo.find({
          where: { transfer_id: In(transfers.map((transfer) => transfer.id)), status: RevertRequestStatus.PENDING },
        })
      : [];
    const pendingByTransfer = new Map(pending.map((request) => [request.transfer_id, request]));
    const data = transfers.map((transfer) => ({
      ...transfer,
      pending_revert_request: pendingByTransfer.get(transfer.id) ?? null,
    }));
    return { data, total, page, limit };
  }
}
