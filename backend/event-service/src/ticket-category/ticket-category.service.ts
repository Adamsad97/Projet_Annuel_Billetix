import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { firstValueFrom } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { Event } from '../event/event.entity';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { TicketTierTypeService } from '../ticket-tier-type/ticket-tier-type.service';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { TicketCategory } from './ticket-category.entity';

@Injectable()
export class TicketCategoryService {
  constructor(
    @InjectRepository(TicketCategory)
    private readonly repo: Repository<TicketCategory>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notifClient: ClientProxy,
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientProxy,
    @Inject('USER_SERVICE')
    private readonly userClient: ClientProxy,
    private readonly dataSource: DataSource,
    private readonly platformConfig: PlatformConfigCache,
    private readonly ticketTierTypeService: TicketTierTypeService,
  ) {}

  /**
   * Préférences niveau 2 (CDC — désactivation réelle des envois) : un échec
   * de lecture des préférences ne doit jamais bloquer l'alerte — on envoie
   * par défaut (fail-open), comme le ferait l'absence de préférence
   * enregistrée (voir user-service BuyerService.getNotificationPrefs).
   */
  private async wantsFillThresholdAlert(organizerId: string): Promise<boolean> {
    try {
      const prefs = await firstValueFrom(
        this.userClient.send<Record<string, boolean>>('user.get_notification_prefs', {
          user_id: organizerId,
        }),
      );
      return prefs['low-stock'] !== false;
    } catch {
      return true;
    }
  }

  /** Lève 403 si l'événement n'existe pas ou n'appartient pas à cet organisateur. */
  private async assertOwnsEvent(eventId: string, organizerId: string): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event || event.organizer_id !== organizerId) {
      throw new RpcException({ statusCode: 403, message: 'Non autorisé' });
    }
    return event;
  }

  /**
   * Bug corrigé : rien n'empêchait la somme des quotas des catégories de
   * billets de dépasser la capacité totale de l'événement (ex: 500 places
   * mais 500 + 40 places réparties en catégories) — repéré par un
   * organisateur sur le formulaire de création. `excludeId` permet à
   * update() de s'auto-exclure du total déjà comptabilisé.
   */
  private async assertQuotaWithinCapacity(
    eventId: string,
    totalCapacity: number,
    newQuota: number,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repo.find({ where: { event_id: eventId, is_active: true } });
    const otherQuotas = existing
      .filter((category) => category.id !== excludeId)
      .reduce((sum, category) => sum + category.quota, 0);
    const total = otherQuotas + newQuota;
    if (total > totalCapacity) {
      throw new RpcException({
        statusCode: 400,
        message: `La somme des quotas (${total}) dépasse la capacité totale de l'événement (${totalCapacity})`,
      });
    }
  }

  /**
   * Bug corrigé : rien n'empêchait d'ajouter deux fois la même catégorie de
   * billet (ex: "Standard" en double avec des prix/quotas différents) sur un
   * même événement — repéré par un organisateur sur le formulaire de
   * création. Un même nom ne peut désormais être actif qu'une seule fois par
   * événement (`excludeId` permet à update() de s'auto-exclure).
   */
  private async assertNameNotUsed(eventId: string, name: string, excludeId?: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { event_id: eventId, name, is_active: true } });
    if (existing && existing.id !== excludeId) {
      throw new RpcException({
        statusCode: 400,
        message: `La catégorie "${name}" existe déjà pour cet événement`,
      });
    }
  }

  async create(dto: CreateTicketCategoryDto, organizerId: string): Promise<TicketCategory> {
    const event = await this.assertOwnsEvent(dto.event_id, organizerId);
    await this.ticketTierTypeService.assertActive(dto.name);
    await this.assertNameNotUsed(dto.event_id, dto.name);
    await this.assertQuotaWithinCapacity(dto.event_id, event.total_capacity, dto.quota);
    const category = this.repo.create({
      ...dto,
      remaining_quota: dto.quota,
    });
    return this.repo.save(category);
  }

  async getByEvent(eventId: string): Promise<TicketCategory[]> {
    // Bug corrigé (même cause que EventService.getById) : un event_id mal
    // formé faisait planter Postgres ("invalid input syntax for type
    // uuid") en 500 brut au lieu de simplement ne trouver aucune catégorie.
    if (!isUUID(eventId)) return [];
    return this.repo.find({ where: { event_id: eventId, is_active: true } });
  }

  async getById(id: string): Promise<TicketCategory> {
    if (!isUUID(id)) {
      throw new RpcException({ statusCode: 404, message: 'Catégorie introuvable' });
    }
    const category = await this.repo.findOne({ where: { id } });
    if (!category) throw new RpcException({ statusCode: 404, message: 'Catégorie introuvable' });
    return category;
  }

  async update(id: string, dto: Partial<CreateTicketCategoryDto>, organizerId: string): Promise<TicketCategory> {
    const category = await this.getById(id);
    const event = await this.assertOwnsEvent(category.event_id, organizerId);
    if (dto.name) {
      await this.ticketTierTypeService.assertActive(dto.name);
      await this.assertNameNotUsed(category.event_id, dto.name, category.id);
    }
    if (dto.quota !== undefined) {
      await this.assertQuotaWithinCapacity(category.event_id, event.total_capacity, dto.quota, category.id);
    }
    Object.assign(category, dto);
    return this.repo.save(category);
  }

  async deactivate(id: string, organizerId: string): Promise<{ success: boolean }> {
    const category = await this.getById(id);
    await this.assertOwnsEvent(category.event_id, organizerId);
    await this.repo.update(id, { is_active: false });
    return { success: true };
  }

  // Décrémentation atomique — protège contre les surréservations
  async decrementQuota(id: string, quantity: number): Promise<{ success: boolean }> {
    // CDC §3.2 : "Limite par commande" (mesure anti-scalping) — le champ
    // max_per_order existait déjà sur la catégorie mais n'était vérifié
    // nulle part dans le backend, ni ici ni côté order-service. Bug corrigé.
    const category = await this.repo.findOne({ where: { id } });
    if (!category) {
      throw new RpcException({ statusCode: 404, message: 'Catégorie de billet introuvable' });
    }
    if (quantity > category.max_per_order) {
      throw new RpcException({
        statusCode: 400,
        message: `Maximum ${category.max_per_order} billet(s) par commande pour la catégorie "${category.name}"`,
      });
    }

    // Bug corrigé (règle produit jamais appliquée) : sales_start_date/
    // sales_end_date (événement + override optionnel par catégorie,
    // ticket-category.entity.ts) étaient stockées mais jamais vérifiées à
    // l'achat — un événement validé par un admin restait achetable à
    // n'importe quel moment, même avant l'ouverture des ventes choisie par
    // l'organisateur ou après leur fermeture. Un override par catégorie
    // (s'il est défini) prime sur la fenêtre globale de l'événement — sinon
    // on hérite de celle de l'événement.
    const event = await this.eventRepo.findOne({ where: { id: category.event_id } });
    if (!event) {
      throw new RpcException({ statusCode: 404, message: 'Événement introuvable' });
    }
    const salesStart = category.sales_start_date ?? event.sales_start_date;
    const salesEnd = category.sales_end_date ?? event.sales_end_date;
    const now = Date.now();
    if (salesStart && now < new Date(salesStart).getTime()) {
      throw new RpcException({
        statusCode: 403,
        message: `Les ventes pour "${category.name}" ne sont pas encore ouvertes (ouverture le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(salesStart))})`,
      });
    }
    if (salesEnd && now > new Date(salesEnd).getTime()) {
      throw new RpcException({
        statusCode: 403,
        message: `Les ventes pour "${category.name}" sont closes depuis le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(salesEnd))}`,
      });
    }

    const rows = await this.dataSource.query(
      `UPDATE events.ticket_categories
       SET remaining_quota = remaining_quota - $1
       WHERE id = $2 AND remaining_quota >= $1 AND is_active = true
       RETURNING id, event_id`,
      [quantity, id],
    );
    if (!rows[0].length) {
      throw new RpcException({ statusCode: 409, message: 'Places insuffisantes ou catégorie inactive' });
    }

    const eventId = rows[0][0].event_id as string;
    this.checkAndNotifyFillThresholds(eventId).catch(() => undefined);

    return { success: true };
  }

  /** Stats de remplissage par catégorie + agrégat — source de vérité "vendu" (compteur dénormalisé, pas recalculé depuis les commandes). */
  async getFillStats(eventId: string): Promise<{
    total_quota: number;
    remaining: number;
    sold: number;
    fill_rate: number;
    categories: Array<{
      id: string;
      name: string;
      quota: number;
      remaining_quota: number;
      sold: number;
      price_ht: number;
    }>;
  }> {
    const categories = await this.repo.find({
      where: { event_id: eventId, is_active: true },
    });

    const total_quota = categories.reduce((sum, category) => sum + category.quota, 0);
    const remaining = categories.reduce(
      (sum, category) => sum + category.remaining_quota,
      0,
    );
    const sold = total_quota - remaining;

    return {
      total_quota,
      remaining,
      sold,
      fill_rate: total_quota > 0 ? (sold / total_quota) * 100 : 0,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        quota: category.quota,
        remaining_quota: category.remaining_quota,
        sold: category.quota - category.remaining_quota,
        price_ht: Number(category.price_ht),
      })),
    };
  }

  private async checkAndNotifyFillThresholds(eventId: string): Promise<void> {
    const stats = await this.getFillStats(eventId);
    if (stats.total_quota === 0) return;

    const soldCount = stats.sold;
    const fillRate = stats.fill_rate;

    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) return;

    const alreadyNotified: number[] = Array.isArray(event.fill_thresholds_notified)
      ? event.fill_thresholds_notified
      : [];

    const config = await this.platformConfig.get();
    const newThresholds = config.fill_thresholds.filter(
      (threshold) => fillRate >= threshold && !alreadyNotified.includes(threshold),
    );

    if (newThresholds.length === 0) return;

    event.fill_thresholds_notified = [...alreadyNotified, ...newThresholds];
    await this.eventRepo.save(event);

    let organizerEmail: string | null = null;
    let organizerFirstName: string | null = null;
    try {
      const organizer = await firstValueFrom(
        this.authClient.send('auth.get_user', { id: event.organizer_id }),
      ) as { email: string; first_name: string } | null;
      organizerEmail = organizer?.email ?? null;
      organizerFirstName = organizer?.first_name ?? null;
    } catch {
      // non bloquant
    }

    if (!(await this.wantsFillThresholdAlert(event.organizer_id))) return;

    for (const threshold of newThresholds) {
      this.notifClient.emit('notification.fill_threshold_reached', {
        email: organizerEmail,
        firstName: organizerFirstName,
        organizer_id: event.organizer_id,
        event_id: event.id,
        event_name: event.title,
        threshold,
        sold_count: soldCount,
        total_capacity: stats.total_quota,
      });
    }
  }

  // Restauration des places en cas d'annulation de commande
  async restoreQuota(id: string, quantity: number): Promise<{ success: boolean }> {
    await this.dataSource.query(
      `UPDATE events.ticket_categories
       SET remaining_quota = LEAST(remaining_quota + $1, quota)
       WHERE id = $2`,
      [quantity, id],
    );
    return { success: true };
  }
}
