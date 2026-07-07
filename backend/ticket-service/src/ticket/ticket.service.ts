import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { GenerateTicketsDto } from './dto/generate-tickets.dto';
import { Ticket, TicketStatus } from './ticket.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket) private readonly repo: Repository<Ticket>,
    private readonly config: ConfigService,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async generate(dto: GenerateTicketsDto): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (const orderItem of dto.items) {
      for (let ticketIndex = 0; ticketIndex < orderItem.quantity; ticketIndex++) {
        const ticket = this.repo.create({
          reference: this.generateReference(),
          order_id: dto.order_id,
          order_item_id: orderItem.order_item_id,
          buyer_id: dto.buyer_id,
          buyer_email: dto.buyer_email,
          holder_first_name: orderItem.holder_first_name,
          holder_last_name: orderItem.holder_last_name,
          // Événement
          event_id: dto.event_id,
          event_name: dto.event_name,
          event_start_at: new Date(dto.event_start_at),
          event_end_at: dto.event_end_at ? new Date(dto.event_end_at) : null,
          event_venue_name: dto.event_venue_name,
          event_venue_address: dto.event_venue_address,
          event_city: dto.event_city,
          event_poster_url: dto.event_poster_url ?? null,
          // Artiste
          artist_name: dto.artist_name,
          artist_description: dto.artist_description ?? null,
          // Catégorie
          ticket_category_id: orderItem.ticket_category_id,
          ticket_category_name: orderItem.ticket_category_name,
          unit_price_ttc: orderItem.unit_price_ttc,
          seat_info: orderItem.seat_info ?? null,
          // QR
          qr_code_token: this.generateQrToken(dto.order_id, dto.event_id),
        });

        const saved = await this.repo.save(ticket);
        saved.qr_code_url = await this.generateQrImage(saved.qr_code_token);
        await this.repo.save(saved);
        tickets.push(saved);
      }
    }

    return tickets;
  }

  async getById(id: string): Promise<Ticket> {
    const ticket = await this.repo.findOne({ where: { id } });
    if (!ticket) throw new RpcException({ statusCode: 404, message: 'Billet introuvable' });
    return ticket;
  }

  async getByOrder(orderId: string): Promise<Ticket[]> {
    return this.repo.find({ where: { order_id: orderId } });
  }

  /** Répartition des billets par statut pour un événement — utile pour le suivi temps réel (scans en cours). */
  async getStatsByEvent(eventId: string): Promise<{
    total: number;
    used: number;
    active: number;
    cancelled: number;
    for_resale: number;
  }> {
    const rows = await this.repo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('t.event_id = :eventId', { eventId })
      .groupBy('t.status')
      .getRawMany<{ status: TicketStatus; count: string }>();

    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.status] = parseInt(row.count, 10);

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return {
      total,
      used: counts[TicketStatus.USED] ?? 0,
      active:
        (counts[TicketStatus.GENERATED] ?? 0) + (counts[TicketStatus.SENT] ?? 0),
      cancelled:
        (counts[TicketStatus.CANCELLED] ?? 0) + (counts[TicketStatus.REFUNDED] ?? 0),
      for_resale: counts[TicketStatus.FOR_RESALE] ?? 0,
    };
  }

  async verifyQr(token: string): Promise<{ valid: boolean; ticket: Ticket }> {
    const ticket = await this.repo.findOne({ where: { qr_code_token: token } });
    if (!ticket) throw new RpcException({ statusCode: 404, message: 'QR code invalide' });

    if (ticket.status === TicketStatus.USED) {
      throw new RpcException({ statusCode: 409, message: 'Billet déjà utilisé' });
    }
    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.REFUNDED) {
      throw new RpcException({ statusCode: 400, message: 'Billet annulé ou remboursé' });
    }
    if (ticket.status === TicketStatus.FOR_RESALE) {
      throw new RpcException({ statusCode: 400, message: 'Billet en cours de revente' });
    }

    return { valid: true, ticket };
  }

  async markSent(orderId: string): Promise<{ success: boolean }> {
    await this.repo.update({ order_id: orderId }, { status: TicketStatus.SENT });
    return { success: true };
  }

  async markUsed(id: string, agentId: string, deviceInfo?: string): Promise<Ticket> {
    const ticket = await this.getById(id);
    ticket.status = TicketStatus.USED;
    ticket.scanned_at = new Date();
    ticket.scanned_by = agentId;
    ticket.scan_device_info = deviceInfo ?? null;
    return this.repo.save(ticket);
  }

  async cancel(id: string): Promise<Ticket> {
    const ticket = await this.getById(id);
    this.assertCancellable(ticket);
    await this.assertNotWithinDeadline(ticket);
    ticket.status = TicketStatus.CANCELLED;
    return this.repo.save(ticket);
  }

  async markForResale(id: string): Promise<Ticket> {
    const ticket = await this.getById(id);
    this.assertCancellable(ticket);

    if (ticket.event_start_at <= new Date()) {
      throw new RpcException({ statusCode: 400, message: 'L\'événement est déjà passé' });
    }

    ticket.status = TicketStatus.FOR_RESALE;
    return this.repo.save(ticket);
  }

  // Appelé quand le nouvel acheteur a payé — transfert du billet
  async transferToNewBuyer(id: string, newBuyerId: string, newOrderId: string): Promise<Ticket> {
    const ticket = await this.getById(id);
    if (ticket.status !== TicketStatus.FOR_RESALE) {
      throw new RpcException({ statusCode: 400, message: 'Ce billet n\'est pas en revente' });
    }
    ticket.buyer_id = newBuyerId;
    ticket.order_id = newOrderId;
    ticket.status = TicketStatus.SENT;
    // Nouveau QR code pour invaliditer l'ancien
    ticket.qr_code_token = this.generateQrToken(newOrderId, ticket.event_id);
    ticket.qr_code_url = await this.generateQrImage(ticket.qr_code_token);
    return this.repo.save(ticket);
  }

  // Remet un billet FOR_RESALE en SENT quand le vendeur retire son offre
  async cancelResaleAndRestore(id: string): Promise<void> {
    await this.repo.update(id, { status: TicketStatus.SENT });
  }

  async cancelByEvent(eventId: string): Promise<{ cancelled_count: number }> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Ticket)
      .set({ status: TicketStatus.CANCELLED })
      .where('event_id = :eventId', { eventId })
      .andWhere('status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.REFUNDED, TicketStatus.USED],
      })
      .execute();
    return { cancelled_count: result.affected ?? 0 };
  }

  async invalidate(id: string, adminId: string, reason: string): Promise<Ticket> {
    const ticket = await this.getById(id);
    ticket.status = TicketStatus.CANCELLED;
    ticket.invalidated_at = new Date();
    ticket.invalidated_by = adminId;
    ticket.invalidation_reason = reason;
    return this.repo.save(ticket);
  }

  async setPdfUrl(id: string, url: string): Promise<Ticket> {
    await this.repo.update(id, { pdf_url: url });
    return this.repo.findOne({ where: { id } });
  }

  private assertCancellable(ticket: Ticket): void {
    const nonCancellable: TicketStatus[] = [
      TicketStatus.USED,
      TicketStatus.CANCELLED,
      TicketStatus.REFUNDED,
    ];
    if (nonCancellable.includes(ticket.status)) {
      throw new RpcException({
        statusCode: 400,
        message: 'Ce billet ne peut pas être annulé',
      });
    }
  }

  private async assertNotWithinDeadline(ticket: Ticket): Promise<void> {
    const config = await this.platformConfig.get();
    const hoursBeforeEvent =
      (ticket.event_start_at.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursBeforeEvent < config.cancel_deadline_hours) {
      throw new RpcException({
        statusCode: 403,
        message: `Annulation impossible à moins de ${config.cancel_deadline_hours}h du spectacle. Vous pouvez remettre votre billet en vente.`,
        resaleAvailable: true,
      });
    }
  }

  private generateReference(): string {
    const year = new Date().getFullYear();
    const random = randomBytes(3).toString('hex').toUpperCase();
    return `TKT-${year}-${random}`;
  }

  private generateQrToken(orderId: string, eventId: string): string {
    const secret = this.config.get<string>('QR_SECRET') ?? 'default_secret';
    const nonce = randomBytes(8).toString('hex');
    return createHmac('sha256', secret)
      .update(`${orderId}:${eventId}:${nonce}`)
      .digest('hex');
  }

  private async generateQrImage(token: string): Promise<string> {
    return QRCode.toDataURL(token, { errorCorrectionLevel: 'H', width: 300 });
  }
}
