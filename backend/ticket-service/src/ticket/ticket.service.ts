import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { DataSource, Repository } from 'typeorm';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { GenerateTicketsDto } from './dto/generate-tickets.dto';
import { QrDisplayCode } from './qr-display-code.entity';
import { QrTokenHistory } from './qr-token-history.entity';
import { Ticket, TicketStatus } from './ticket.entity';

/** Préfixe du contenu des QR codes éphémères (format du texte scanné). */
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
  ) {}

  /**
   * QR à afficher dans l'espace acheteur. Contenu : `BTX2.<code>`, où code
   * est une valeur aléatoire de 128 bits propre à la période en cours —
   * aucune donnée du billet (jeton, référence, porteur, événement) n'y
   * figure. Un même code est servi pendant toute la période (plusieurs
   * affichages simultanés, rafraîchissements), un nouveau à la suivante.
   */
  async getDisplayQr(id: string): Promise<{ qr_code_url: string; refresh_in_seconds: number }> {
    const ticket = await this.getById(id);
    const { ticket_qr_rotation_seconds: period } = await this.platformConfig.get();
    const periodMs = period * 1000;
    const now = Date.now();
    const validFrom = new Date(Math.floor(now / periodMs) * periodMs);
    const validUntil = new Date(validFrom.getTime() + periodMs);

    let display = await this.displayCodeRepo.findOne({
      where: { ticket_id: ticket.id, ticket_token: ticket.qr_code_token, valid_from: validFrom },
    });
    if (!display) {
      display = await this.displayCodeRepo.save(
        this.displayCodeRepo.create({
          code: randomBytes(16).toString('base64url'),
          ticket_id: ticket.id,
          ticket_token: ticket.qr_code_token,
          valid_from: validFrom,
          valid_until: validUntil,
        }),
      );
    }

    return {
      qr_code_url: await QRCode.toDataURL(`${DISPLAY_CODE_PREFIX}.${display.code}`, {
        errorCorrectionLevel: 'M',
        width: 300,
      }),
      refresh_in_seconds: Math.max(1, Math.ceil((validUntil.getTime() - now) / 1000)),
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
          // Repli sur l'acheteur si aucun titulaire n'a été précisé pour ce
          // billet (holder_first_name/last_name sont optionnels côté
          // CreateOrderDto — bug corrigé : NOT NULL en base sinon violé).
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

  /** Liste des billets d'un événement — alimente la page "Gestion d'un
   * événement" côté organisateur (participants + statut de chacun). */
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

  /**
   * Retrouve l'ID du billet visé par un QR scanné — code éphémère
   * (qr_display_codes) ou ancien QR fixe (jeton, qr_token_history), ce
   * dernier étant ensuite refusé par verifyQr(). Utilisé par ScanService
   * pour journaliser le bon billet même quand le scan échoue ensuite (déjà
   * utilisé, expiré…), sans dépendre d'un texte d'erreur.
   */
  async resolveTicketId(raw: string): Promise<string> {
    const code = this.parseDisplayCode(raw);
    const ticketId = code
      ? (await this.displayCodeRepo.findOne({ where: { code } }))?.ticket_id
      : (await this.qrHistoryRepo.findOne({ where: { token: raw } }))?.ticket_id;
    if (!ticketId) {
      throw new RpcException({ statusCode: 400, code: 'INVALID', message: 'QR code invalide' });
    }
    return ticketId;
  }

  /**
   * @param raw contenu du QR scanné (`BTX2.<code>`, texte envoyé tel quel
   *            par l'application de contrôle)
   * @param at  heure du scan — celle du scan hors ligne lors d'une
   *            synchronisation, pour juger si le code était valable.
   */
  async verifyQr(raw: string, at: Date = new Date()): Promise<{ valid: boolean; ticket: Ticket }> {
    const ticketId = await this.resolveTicketId(raw);
    const code = this.parseDisplayCode(raw);
    if (!code) {
      // Jeton connu (resolveTicketId a réussi) mais présenté en QR fixe.
      throw new RpcException({
        statusCode: 409,
        code: 'STATIC_REFUSED',
        message: "QR fixe refusé (PDF ou capture) — le porteur doit afficher son billet en direct depuis l'application",
      });
    }

    const display = await this.displayCodeRepo.findOne({ where: { code } });
    const { ticket_qr_rotation_seconds: period, ticket_qr_rotation_tolerance_steps: tolerance } =
      await this.platformConfig.get();
    const toleranceMs = tolerance * period * 1000;
    if (
      !display ||
      at.getTime() < display.valid_from.getTime() - toleranceMs ||
      at.getTime() >= display.valid_until.getTime() + toleranceMs
    ) {
      throw new RpcException({
        statusCode: 409,
        code: 'EXPIRED',
        message: "QR code expiré — le porteur doit afficher son billet en direct depuis l'application",
      });
    }

    const ticket = await this.repo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new RpcException({
        statusCode: 404,
        code: 'INVALID',
        message: 'QR code invalide',
      });
    }

    // Code émis avant une revente (transferToNewBuyer a changé le jeton
    // interne) : billet réel mais plus à ce porteur — résultat distinct
    // d'un code inconnu pour l'agent au contrôle.
    if (ticket.qr_code_token !== display.ticket_token) {
      throw new RpcException({
        statusCode: 409,
        code: 'SUPERSEDED',
        message: 'Ce billet a changé de titulaire (revente ou transfert) — ce QR code n\'est plus valide',
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

  /**
   * Appelé quand le nouvel acheteur a payé — transfert du billet.
   * Bug corrigé : buyer_email/holder_first_name/holder_last_name n'étaient
   * jamais mis à jour — le billet gardait le nom/email de l'ancien
   * propriétaire après une revente, y compris pour l'agent de contrôle
   * (nom affiché au scan) et toute notification ultérieure.
   */
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
    // Nouveau jeton QR pour invalider l'ancien : celui-ci reste dans
    // qr_token_history (is_current=false) — verifyQr() le reconnaît donc
    // comme SUPERSEDED plutôt qu'INVALID — pendant que le nouveau devient
    // le seul jeton is_current pour ce billet.
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

  /**
   * Bug corrigé : un remboursement complet (admin ou webhook) ne marquait
   * jamais les billets de la commande comme invalides — ils restaient
   * GENERATED/SENT, donc toujours scannables. Un acheteur remboursé pouvait
   * malgré tout se présenter à l'événement avec un billet valide. Statut
   * REFUNDED déjà défini sur l'entité mais jamais utilisé jusqu'ici.
   */
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
   * Jeton = 32 octets aléatoires (CSPRNG), encodés en base64url. Ne contient
   * ni ticket_id, ni event_id, ni horodatage — aucune information n'est
   * extractible du jeton lui-même. Bug corrigé (CDC — confidentialité du
   * QR) : l'ancien format signait ces champs par HMAC mais les laissait en
   * clair dans le payload (juste encodé en base64, pas chiffré) —
   * décoder le QR suffisait à récupérer ticket_id/event_id/horodatage.
   * Le jeton n'a désormais aucun sens hors de qr_token_history (cf.
   * recordQrToken()/resolveTicketId()) : une valeur opaque, pas un
   * contenant à décoder.
   */
  private generateOpaqueToken(): string {
    return newOpaqueToken();
  }

  /** Enregistre un nouveau jeton comme jeton courant du billet dans
   * qr_token_history — voir resolveTicketId()/verifyQr(). */
  private async recordQrToken(ticketId: string, token: string): Promise<void> {
    await this.qrHistoryRepo.save(
      this.qrHistoryRepo.create({ token, ticket_id: ticketId, is_current: true }),
    );
  }

}
