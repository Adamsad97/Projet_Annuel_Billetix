import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { TicketService } from '../ticket/ticket.service';
import { ResaleStatus, TicketResale } from './ticket-resale.entity';

@Injectable()
export class TicketResaleService {
  constructor(
    @InjectRepository(TicketResale) private readonly repo: Repository<TicketResale>,
    private readonly ticketService: TicketService,
    private readonly dataSource: DataSource,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async requestResale(data: {
    ticket_id: string;
    buyer_id: string;
    original_order_id: string;
    resale_price: number;
  }): Promise<TicketResale> {
    const ticket = await this.ticketService.getById(data.ticket_id);

    if (ticket.buyer_id !== data.buyer_id) {
      throw new RpcException({ statusCode: 403, message: 'Ce billet ne vous appartient pas' });
    }

    if (ticket.event_start_at <= new Date()) {
      throw new RpcException({ statusCode: 400, message: 'L\'événement est déjà passé' });
    }

    // Vérifier qu'il n'y a pas déjà un listing actif pour ce billet
    const existing = await this.repo.findOne({
      where: { ticket_id: data.ticket_id, status: ResaleStatus.LISTED },
    });
    if (existing) {
      throw new RpcException({ statusCode: 409, message: 'Ce billet est déjà en vente' });
    }

    await this.ticketService.markForResale(data.ticket_id);

    return this.repo.save(
      this.repo.create({
        ticket_id: data.ticket_id,
        original_order_id: data.original_order_id,
        original_buyer_id: data.buyer_id,
        resale_price: data.resale_price,
        event_id: ticket.event_id,
        event_start_at: ticket.event_start_at,
        ticket_category_id: ticket.ticket_category_id,
        holder_first_name: ticket.holder_first_name,
        holder_last_name: ticket.holder_last_name,
      }),
    );
  }

  async listByEvent(eventId: string): Promise<TicketResale[]> {
    return this.repo
      .createQueryBuilder('r')
      .where('r.event_id = :eventId', { eventId })
      .andWhere('r.status = :status', { status: ResaleStatus.LISTED })
      .andWhere('r.event_start_at > NOW()')
      .orderBy('r.listed_at', 'ASC')
      .getMany();
  }

  async getById(id: string): Promise<TicketResale> {
    const resale = await this.repo.findOne({ where: { id } });
    if (!resale) throw new RpcException({ statusCode: 404, message: 'Offre de revente introuvable' });
    return resale;
  }

  /**
   * Réserve atomiquement une offre pour le temps du paiement — évite que
   * deux acheteurs créent chacun une commande sur la même offre encore
   * LISTED. Une réservation expirée (paiement jamais finalisé) redevient
   * automatiquement réclamable, sans attendre le cron de nettoyage.
   */
  async reserve(resaleId: string, buyerId: string): Promise<TicketResale> {
    const config = await this.platformConfig.get();
    const expiresAt = new Date(Date.now() + config.resale_reservation_minutes * 60 * 1000);

    const rows = await this.dataSource.query(
      `UPDATE tickets.ticket_resales
       SET status = 'RESERVED', reserved_by_buyer_id = $1, reservation_expires_at = $2
       WHERE id = $3
         AND (status = 'LISTED' OR (status = 'RESERVED' AND reservation_expires_at < now()))
       RETURNING *`,
      [buyerId, expiresAt, resaleId],
    );

    if (!rows[0]?.length) {
      const existing = await this.repo.findOne({ where: { id: resaleId } });
      if (!existing) throw new RpcException({ statusCode: 404, message: 'Offre de revente introuvable' });
      throw new RpcException({
        statusCode: 409,
        message: 'Cette offre de revente est déjà en cours d\'achat par quelqu\'un d\'autre ou n\'est plus disponible',
      });
    }

    return this.repo.findOne({ where: { id: resaleId } });
  }

  /** Libère une réservation en cours (commande annulée/abandonnée côté order-service) — ne fait rien si l'offre n'est plus RESERVED (déjà vendue, expirée par le cron, etc.). */
  async releaseReservation(resaleId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE tickets.ticket_resales
       SET status = 'LISTED', reserved_by_buyer_id = NULL, reservation_expires_at = NULL
       WHERE id = $1 AND status = 'RESERVED'`,
      [resaleId],
    );
  }

  /** Appelé par un cron : reclasse en LISTED les réservations expirées (paiement jamais finalisé). */
  async releaseStaleReservations(): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(TicketResale)
      .set({ status: ResaleStatus.LISTED, reserved_by_buyer_id: null, reservation_expires_at: null })
      .where('status = :status', { status: ResaleStatus.RESERVED })
      .andWhere('reservation_expires_at < NOW()')
      .execute();
  }

  // Appelé après confirmation du paiement du nouvel acheteur
  async completeResale(data: {
    resale_id: string;
    new_buyer_id: string;
    new_order_id: string;
  }): Promise<{ resale: TicketResale; originalOrderId: string }> {
    const resale = await this.getById(data.resale_id);

    // L'offre doit avoir été réservée par ce même acheteur via reserve()
    // (appelé par order-service à la création de la commande) — un statut
    // LISTED ici signifierait un paiement complété sans être passé par la
    // réservation, ce qui ne doit plus arriver avec le flux actuel.
    if (
      resale.status !== ResaleStatus.RESERVED ||
      resale.reserved_by_buyer_id !== data.new_buyer_id
    ) {
      throw new RpcException({ statusCode: 409, message: 'Cette offre n\'est plus disponible' });
    }

    // Transférer le billet au nouvel acheteur (nouveau QR code généré)
    await this.ticketService.transferToNewBuyer(
      resale.ticket_id,
      data.new_buyer_id,
      data.new_order_id,
    );

    resale.status = ResaleStatus.SOLD;
    resale.reserved_by_buyer_id = null;
    resale.reservation_expires_at = null;
    resale.new_buyer_id = data.new_buyer_id;
    resale.new_order_id = data.new_order_id;
    resale.sold_at = new Date();
    await this.repo.save(resale);

    return { resale, originalOrderId: resale.original_order_id };
  }

  async withdraw(data: { resale_id: string; buyer_id: string }): Promise<TicketResale> {
    const resale = await this.getById(data.resale_id);

    if (resale.original_buyer_id !== data.buyer_id) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    if (resale.status !== ResaleStatus.LISTED) {
      throw new RpcException({ statusCode: 400, message: 'Cette offre ne peut plus être retirée' });
    }

    await this.ticketService.cancelResaleAndRestore(resale.ticket_id);

    resale.status = ResaleStatus.WITHDRAWN;
    return this.repo.save(resale);
  }

  // Appelé par un cron : expire les annonces passées
  async expireOldListings(): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(TicketResale)
      .set({ status: ResaleStatus.EXPIRED })
      .where('status = :status', { status: ResaleStatus.LISTED })
      .andWhere('event_start_at <= NOW()')
      .execute();
  }
}
