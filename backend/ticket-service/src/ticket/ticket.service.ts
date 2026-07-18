import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import * as QRCode from 'qrcode';
import { DataSource, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { GenerateTicketsDto } from './dto/generate-tickets.dto';
import { Ticket, TicketStatus } from './ticket.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket) private readonly repo: Repository<Ticket>,
    private readonly config: ConfigService,
    private readonly platformConfig: PlatformConfigCache,
    private readonly dataSource: DataSource,
  ) {}

  async generate(dto: GenerateTicketsDto): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (const orderItem of dto.items) {
      for (let ticketIndex = 0; ticketIndex < orderItem.quantity; ticketIndex++) {
        // ID généré ici (plutôt que par la base) pour pouvoir signer le
        // token QR avec l'ID du billet dès la création, en un seul save().
        const id = randomUUID();
        const qrToken = this.generateQrToken(id, dto.event_id);

        const ticket = this.repo.create({
          id,
          qr_code_token: qrToken,
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
        });

        const saved = await this.repo.save(ticket);
        saved.qr_code_url = await this.generateQrImage(qrToken);
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

    const total = Object.values(counts).reduce(
      (sum, statusCount) => sum + statusCount,
      0,
    );
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

  /**
   * Vérifie la signature HMAC du token et en extrait l'ID billet, l'ID
   * événement et l'horodatage d'émission — recalcul cryptographique
   * (comparaison en temps constant), pas un simple lookup en base. Utilisé
   * par verifyQr() et par ScanService pour connaître l'ID du billet même
   * quand le scan échoue ensuite (déjà utilisé/annulé), sans dépendre d'un
   * texte d'erreur.
   */
  parseQrToken(token: string): { ticketId: string; eventId: string; issuedAt: number } {
    const invalid = () =>
      new RpcException({
        statusCode: 400,
        code: 'INVALID',
        message: 'QR code invalide',
      });

    const [payloadB64, signature] = (token ?? '').split('.');
    if (!payloadB64 || !signature) throw invalid();

    const secret = this.config.get<string>('QR_HMAC_SECRET');
    const expectedSignature = createHmac('sha256', secret)
      .update(payloadB64)
      .digest('hex');

    const providedBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    if (
      providedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw invalid();
    }

    const decoded = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const [ticketId, eventId, issuedAtStr] = decoded.split(':');
    const issuedAt = parseInt(issuedAtStr, 10);
    if (!ticketId || !eventId || !Number.isFinite(issuedAt)) throw invalid();

    return { ticketId, eventId, issuedAt };
  }

  async verifyQr(token: string): Promise<{ valid: boolean; ticket: Ticket }> {
    const { ticketId, eventId: signedEventId } = this.parseQrToken(token);

    const ticket = await this.repo.findOne({ where: { id: ticketId } });
    // qr_code_token !== token : le billet existe et la signature est valide,
    // mais ce n'est plus le token actuel (ex: billet transféré depuis) — un
    // simple recalcul de signature ne suffit pas, il faut aussi cette
    // vérification d'état pour invalider les anciens QR après transfert.
    if (!ticket || ticket.qr_code_token !== token) {
      throw new RpcException({
        statusCode: 404,
        code: 'INVALID',
        message: 'QR code invalide',
      });
    }

    // L'ID événement signé dans le token doit correspondre à celui du billet
    // en base — ne devrait jamais diverger en fonctionnement normal (le
    // token est régénéré à chaque transfert), donc un écart signale une
    // donnée corrompue ou une tentative de trafic : traité comme invalide.
    if (signedEventId !== ticket.event_id) {
      throw new RpcException({
        statusCode: 404,
        code: 'INVALID',
        message: 'QR code invalide',
      });
    }

    if (ticket.status === TicketStatus.USED) {
      throw new RpcException({
        statusCode: 409,
        code: 'ALREADY_USED',
        message: 'Billet déjà utilisé',
      });
    }
    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.REFUNDED) {
      throw new RpcException({
        statusCode: 400,
        code: 'CANCELLED',
        message: 'Billet annulé ou remboursé',
      });
    }
    if (ticket.status === TicketStatus.FOR_RESALE) {
      throw new RpcException({
        statusCode: 400,
        code: 'INVALID',
        message: 'Billet en cours de revente',
      });
    }

    return { valid: true, ticket };
  }

  async markSent(orderId: string): Promise<{ success: boolean }> {
    await this.repo.update({ order_id: orderId }, { status: TicketStatus.SENT });
    return { success: true };
  }

  /**
   * Transition atomique GENERATED/SENT -> USED (UPDATE conditionnel, pas de
   * lecture puis écriture séparées) — deux scans quasi simultanés du même
   * billet ne peuvent plus tous les deux réussir : seul le premier UPDATE
   * affecte une ligne, le second reçoit ALREADY_USED même s'il a lu le
   * statut via verifyQr() avant que le premier n'ait écrit.
   */
  async markUsed(id: string, agentId: string, deviceInfo?: string): Promise<Ticket> {
    const rows = await this.dataSource.query(
      `UPDATE tickets.tickets
       SET status = 'USED', scanned_at = $1, scanned_by = $2, scan_device_info = $3
       WHERE id = $4 AND status IN ('GENERATED', 'SENT')
       RETURNING id`,
      [new Date(), agentId, deviceInfo ?? null, id],
    );

    if (!rows[0]?.length) {
      throw new RpcException({
        statusCode: 409,
        code: 'ALREADY_USED',
        message: 'Billet déjà utilisé',
      });
    }

    return this.getById(id);
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
    // Nouveau QR code pour invalider l'ancien (même ticket_id, nouvel horodatage —
    // l'ancien token reste cryptographiquement valide mais ne correspond plus au
    // qr_code_token actuellement stocké, donc verifyQr() le rejette).
    ticket.qr_code_token = this.generateQrToken(ticket.id, ticket.event_id);
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

  /**
   * Token = payload (ID billet + ID événement + horodatage, base64url) +
   * signature HMAC-SHA256 du payload. Contrairement à l'ancien format
   * (ticketId+horodatage seuls), l'événement est désormais cryptographiquement
   * lié au token — cf. CDC 5.3 — et directement extractible/vérifiable par
   * recalcul de signature, cf. parseQrToken().
   */
  private generateQrToken(ticketId: string, eventId: string): string {
    const secret = this.config.get<string>('QR_HMAC_SECRET');
    const payload = `${ticketId}:${eventId}:${Date.now()}`;
    const payloadB64 = Buffer.from(payload).toString('base64url');
    const signature = createHmac('sha256', secret)
      .update(payloadB64)
      .digest('hex');
    return `${payloadB64}.${signature}`;
  }

  private async generateQrImage(token: string): Promise<string> {
    return QRCode.toDataURL(token, { errorCorrectionLevel: 'H', width: 300 });
  }
}
