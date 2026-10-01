import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { DataSource, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { GenerateTicketsDto } from './dto/generate-tickets.dto';
import { QrDisplayCode } from './qr-display-code.entity';
import { QrSigner, tokenFingerprint } from './qr-signer';
import { QrTokenHistory } from './qr-token-history.entity';
import { Ticket, TicketStatus } from './ticket.entity';

/** Ancien format de QR éphémère (code aléatoire), remplacé par le QR signé BTX3. */
export const DISPLAY_CODE_PREFIX = 'BTX2';

/** Jeton interne d'un billet : valeur aléatoire pure (cf. generateOpaqueToken). */
export function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket) private readonly repo: Repository<Ticket>,
    @InjectRepository(QrTokenHistory)
    private readonly qrHistoryRepo: Repository<QrTokenHistory>,
    @InjectRepository(QrDisplayCode)
    private readonly displayCodeRepo: Repository<QrDisplayCode>,
    private readonly platformConfig: PlatformConfigCache,
    private readonly dataSource: DataSource,
    private readonly qrSigner: QrSigner,
  ) {}

  /** QR signé Ed25519 (BTX3) : billet, événement, validité et empreinte du porteur, sans donnée personnelle. */
  async getDisplayQr(id: string): Promise<{ qr_code_url: string; refresh_in_seconds: number }> {
    const ticket = await this.getById(id);
    const { ticket_qr_rotation_seconds: period } = await this.platformConfig.get();
    const now = Date.now();
    const periodMs = period * 1000;
    const validFromMs = Math.floor(now / periodMs) * periodMs;

    const text = this.qrSigner.sign({
      ticketId: ticket.id,
      eventId: ticket.event_id,
      validFrom: Math.floor(validFromMs / 1000),
      validSeconds: period,
      tokenFingerprint: tokenFingerprint(ticket.qr_code_token),
    });

    return {
      qr_code_url: await QRCode.toDataURL(text, { errorCorrectionLevel: 'M', width: 320 }),
      refresh_in_seconds: Math.max(1, Math.ceil((validFromMs + periodMs - now) / 1000)),
    };
  }

  /** Entrées d'un événement : billets scannés sur l'ensemble des billets valables. */
  async getEntryStats(eventId: string): Promise<{ admitted: number; expected: number }> {
    const rows: Array<{ status: TicketStatus; count: string }> = await this.repo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('t.event_id = :eventId', { eventId })
      .andWhere('t.status NOT IN (:...excluded)', { excluded: [TicketStatus.CANCELLED, TicketStatus.REFUNDED] })
      .groupBy('t.status')
      .getRawMany();
    let admitted = 0;
    let expected = 0;
    for (const row of rows) {
      const count = Number(row.count);
      expected += count;
      if (row.status === TicketStatus.USED) admitted += count;
    }
    return { admitted, expected };
  }

  /** Paquet hors ligne : clé publique, réglages et empreinte et statut de chaque billet, sans donnée personnelle. */
  async getOfflinePack(eventId: string): Promise<{
    algorithm: 'Ed25519';
    public_key: string;
    rotation_seconds: number;
    tolerance_steps: number;
    generated_at: string;
    tickets: Array<{ id: string; fingerprint: string; status: TicketStatus }>;
  }> {
    const { ticket_qr_rotation_seconds: period, ticket_qr_rotation_tolerance_steps: tolerance } =
      await this.platformConfig.get();
    const tickets = await this.repo.find({
      // Tous les billets de l'événement : l'appareil hors ligne distingue ainsi
      // un billet annulé ou en revente d'un QR inconnu.
      where: { event_id: eventId },
    });
    return {
      algorithm: 'Ed25519',
      public_key: this.qrSigner.publicKeyBase64Url,
      rotation_seconds: period,
      tolerance_steps: tolerance,
      generated_at: new Date().toISOString(),
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        fingerprint: tokenFingerprint(ticket.qr_code_token),
        status: ticket.status,
      })),
    };
  }

  /** Code éphémère contenu dans un QR `BTX2.<code>`, null pour tout autre format. */
  private parseDisplayCode(raw: string): string | null {
    const match = new RegExp(`^${DISPLAY_CODE_PREFIX}\\.([A-Za-z0-9_-]{22})$`).exec(raw);
    return match ? match[1] : null;
  }

  async generate(dto: GenerateTicketsDto): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (const orderItem of dto.items) {
      for (let ticketIndex = 0; ticketIndex < orderItem.quantity; ticketIndex++) {
        // ID généré ici (plutôt que par la base) pour l'avoir disponible
        // avant le premier save().
        const id = randomUUID();
        const qrToken = this.generateOpaqueToken();

        const ticket = this.repo.create({
          id,
          qr_code_token: qrToken,
          reference: this.generateReference(),
          order_id: dto.order_id,
          order_item_id: orderItem.order_item_id,
          buyer_id: dto.buyer_id,
          buyer_email: dto.buyer_email,
          // Titulaire par défaut : l'acheteur, si aucun n'a été précisé pour ce billet.
          holder_first_name: orderItem.holder_first_name ?? dto.buyer_first_name,
          holder_last_name: orderItem.holder_last_name ?? dto.buyer_last_name,
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
        await this.recordQrToken(saved.id, qrToken);
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

  /** Billets dont l'utilisateur est aujourd'hui titulaire (achetés, reçus ou rachetés). */
  async getByBuyer(buyerId: string): Promise<Ticket[]> {
    return this.repo.find({ where: { buyer_id: buyerId }, order: { event_start_at: 'ASC' } });
  }

  async getByOrder(orderId: string): Promise<Ticket[]> {
    return this.repo.find({ where: { order_id: orderId } });
  }

  /** Billets d'un événement, pour la page de gestion côté organisateur. */
  async getByEvent(eventId: string): Promise<Ticket[]> {
    return this.repo.find({ where: { event_id: eventId }, order: { created_at: 'ASC' } });
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

  /** ID du billet visé par un QR (BTX3, ancien BTX2 ou ancien QR fixe), pour journaliser le bon billet. */
  async resolveTicketId(raw: string): Promise<string> {
    const claims = this.qrSigner.verify(raw);
    if (claims) return claims.ticketId;
    const code = this.parseDisplayCode(raw);
    const ticketId = code
      ? (await this.displayCodeRepo.findOne({ where: { code } }))?.ticket_id
      : (await this.qrHistoryRepo.findOne({ where: { token: raw } }))?.ticket_id;
    if (!ticketId) {
      throw new RpcException({ statusCode: 400, code: 'INVALID', message: 'QR code invalide' });
    }
    return ticketId;
  }

  /** Vérifie un QR : signature, validité puis billet ; at est l'heure du scan (hors ligne compris). */
  async verifyQr(raw: string, at: Date = new Date()): Promise<{ valid: boolean; ticket: Ticket }> {
    const claims = this.qrSigner.verify(raw);
    if (!claims) {
      await this.resolveTicketId(raw); // INVALID si le texte ne désigne aucun billet
      if (this.parseDisplayCode(raw)) {
        // Ancien QR éphémère non signé (BTX2) : plus accepté.
        throw new RpcException({
          statusCode: 409,
          code: 'EXPIRED',
          message: "QR code expiré — le porteur doit afficher son billet en direct depuis l'application",
        });
      }
      throw new RpcException({
        statusCode: 409,
        code: 'STATIC_REFUSED',
        message: "QR fixe refusé (PDF ou capture) — le porteur doit afficher son billet en direct depuis l'application",
      });
    }

    const { ticket_qr_rotation_tolerance_steps: tolerance } = await this.platformConfig.get();
    const periodMs = claims.validSeconds * 1000;
    const toleranceMs = tolerance * periodMs;
    const validFromMs = claims.validFrom * 1000;
    if (at.getTime() < validFromMs - toleranceMs || at.getTime() >= validFromMs + periodMs + toleranceMs) {
      throw new RpcException({
        statusCode: 409,
        code: 'EXPIRED',
        message: "QR code expiré — le porteur doit afficher son billet en direct depuis l'application",
      });
    }

    const ticket = await this.repo.findOne({ where: { id: claims.ticketId } });
    if (!ticket || ticket.event_id !== claims.eventId) {
      throw new RpcException({ statusCode: 404, code: 'INVALID', message: 'QR code invalide' });
    }

    // Code émis avant une revente ou un transfert (jeton interne changé) :
    // billet réel mais plus à ce porteur.
    if (tokenFingerprint(ticket.qr_code_token) !== claims.tokenFingerprint) {
      throw new RpcException({
        statusCode: 409,
        code: 'SUPERSEDED',
        message: 'Ce billet a changé de titulaire (revente ou transfert) — ce QR code n\'est plus valide',
      });
    }

    if (ticket.status === TicketStatus.USED) {
      throw new RpcException({ statusCode: 409, code: 'ALREADY_USED', message: 'Billet déjà utilisé' });
    }
    if (ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.REFUNDED) {
      throw new RpcException({ statusCode: 400, code: 'CANCELLED', message: 'Billet annulé ou remboursé' });
    }
    if (ticket.status === TicketStatus.FOR_RESALE) {
      // Bug corrigé : signalé INVALID (« falsifié ») alors que le billet est authentique.
      throw new RpcException({ statusCode: 400, code: 'FOR_RESALE', message: 'Billet mis en revente par son titulaire' });
    }

    return { valid: true, ticket };
  }

  async markSent(orderId: string): Promise<{ success: boolean }> {
    await this.repo.update({ order_id: orderId }, { status: TicketStatus.SENT });
    return { success: true };
  }

  /** Passage atomique à USED : de deux scans simultanés, seul le premier réussit. */
  async markUsed(id: string, agentId: string, deviceInfo?: string, expectedToken?: string): Promise<Ticket> {
    // expectedToken rend vérification et consommation indissociables face à une revente ou un transfert.
    const rows = await this.dataSource.query(
      `UPDATE tickets.tickets
       SET status = 'USED', scanned_at = $1, scanned_by = $2, scan_device_info = $3
       WHERE id = $4 AND status IN ('GENERATED', 'SENT')
         AND ($5::text IS NULL OR qr_code_token = $5)
       RETURNING id`,
      [new Date(), agentId, deviceInfo ?? null, id, expectedToken ?? null],
    );

    if (!rows[0]?.length) {
      const current = await this.repo.findOne({ where: { id } });
      if (expectedToken && current && current.qr_code_token !== expectedToken) {
        throw new RpcException({
          statusCode: 409,
          code: 'SUPERSEDED',
          message: "Ce billet a changé de titulaire (revente ou transfert) — ce QR code n'est plus valide",
        });
      }
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

  /** Revente payée : transfert du billet avec mise à jour de l'email et du titulaire. */
  async transferToNewBuyer(
    id: string,
    newBuyerId: string,
    newOrderId: string,
    newBuyerEmail: string,
    newHolderFirstName: string,
    newHolderLastName: string,
  ): Promise<Ticket> {
    const ticket = await this.getById(id);
    if (ticket.status !== TicketStatus.FOR_RESALE) {
      throw new RpcException({ statusCode: 400, message: 'Ce billet n\'est pas en revente' });
    }
    ticket.buyer_id = newBuyerId;
    ticket.order_id = newOrderId;
    ticket.buyer_email = newBuyerEmail;
    ticket.holder_first_name = newHolderFirstName;
    ticket.holder_last_name = newHolderLastName;
    ticket.status = TicketStatus.SENT;
    // Nouveau jeton courant ; l'ancien reste dans l'historique et ressort SUPERSEDED.
    await this.qrHistoryRepo.update({ token: ticket.qr_code_token }, { is_current: false });
    const newToken = this.generateOpaqueToken();
    await this.recordQrToken(ticket.id, newToken);
    ticket.qr_code_token = newToken;
    return this.repo.save(ticket);
  }

  // Remet un billet FOR_RESALE en SENT quand le vendeur retire son offre
  async cancelResaleAndRestore(id: string): Promise<void> {
    await this.repo.update(id, { status: TicketStatus.SENT });
  }

  /** Remboursement complet : les billets de la commande passent REFUNDED et ne sont plus scannables. */
  async cancelByOrder(orderId: string): Promise<{ cancelled_count: number }> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Ticket)
      .set({ status: TicketStatus.REFUNDED })
      .where('order_id = :orderId', { orderId })
      .andWhere('status NOT IN (:...excluded)', {
        excluded: [TicketStatus.CANCELLED, TicketStatus.REFUNDED, TicketStatus.USED],
      })
      .execute();
    return { cancelled_count: result.affected ?? 0 };
  }

  /** Événement reporté : les billets suivent la nouvelle date. */
  async syncEventDates(eventId: string, startAt: Date, endAt: Date): Promise<{ updated: number }> {
    const result = await this.repo.update({ event_id: eventId }, { event_start_at: startAt, event_end_at: endAt });
    return { updated: result.affected ?? 0 };
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

  /** Jeton de 32 octets aléatoires en base64url, sans aucune information extractible. */
  private generateOpaqueToken(): string {
    return newOpaqueToken();
  }

  /** Enregistre un nouveau jeton courant dans qr_token_history. */
  private async recordQrToken(ticketId: string, token: string): Promise<void> {
    await this.qrHistoryRepo.save(
      this.qrHistoryRepo.create({ token, ticket_id: ticketId, is_current: true }),
    );
  }

}
