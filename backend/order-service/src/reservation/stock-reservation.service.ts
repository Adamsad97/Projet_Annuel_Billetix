import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomBytes } from 'crypto';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { RedisService } from '../redis/redis.service';

const KEY_PREFIX = 'reservation:';
// Index (sorted set, sans TTL) des réservations en cours, score = échéance
// (epoch ms) — sans lui, une réservation qui expire sans jamais devenir une
// commande (client parti sans payer) laisse le quota décrémenté à vie : la
// clé Redis à TTL disparaît sans laisser de trace exploitable pour restaurer
// le stock. Bug corrigé — voir restoreExpiredReservations() ci-dessous.
const INDEX_KEY = 'reservations:pending_index';
// Marge de grâce sur le TTL de la clé principale : le cron doit pouvoir
// encore lire les items à restaurer un peu après l'échéance logique — sans
// ça, la clé aurait déjà disparu (TTL Redis) au moment où le cron la cherche.
const GRACE_SECONDS = 120;

export interface ReservationItem {
  ticket_category_id: string;
  quantity: number;
}

export interface ReservationData {
  buyer_id: string;
  event_id: string;
  items: ReservationItem[];
  expires_at: string;
}

@Injectable()
export class StockReservationService {
  constructor(
    private readonly redis: RedisService,
    @Inject('EVENT_SERVICE') private readonly eventClient: ClientProxy,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async reserve(
    buyer_id: string,
    event_id: string,
    items: ReservationItem[],
  ): Promise<{ reservation_token: string; expires_at: Date }> {
    // Décrémentation atomique du quota dans event-service pour chaque catégorie
    const decremented: ReservationItem[] = [];
    try {
      for (const item of items) {
        await firstValueFrom(
          this.eventClient.send('event.decrement_quota', {
            id: item.ticket_category_id,
            quantity: item.quantity,
          }),
        );
        decremented.push(item);
      }
    } catch (quotaError) {
      // Rollback des décrémentations déjà faites
      await this.rollback(decremented);
      throw new RpcException({
        statusCode: 409,
        message: quotaError?.error?.message ?? 'Places insuffisantes',
      });
    }

    const config = await this.platformConfig.get();
    const ttl = config.stock_reservation_ttl_seconds;
    const token = randomBytes(32).toString('hex');
    const expiresAtMs = Date.now() + ttl * 1000;
    const expires_at = new Date(expiresAtMs);

    const data: ReservationData = { buyer_id, event_id, items, expires_at: expires_at.toISOString() };
    // TTL + marge de grâce sur la clé (voir GRACE_SECONDS) — l'expiration
    // logique reste bien `ttl`, appliquée explicitement dans validate().
    await this.redis.set(`${KEY_PREFIX}${token}`, JSON.stringify(data), ttl + GRACE_SECONDS);
    await this.redis.zadd(INDEX_KEY, expiresAtMs, token);

    return { reservation_token: token, expires_at };
  }

  async validate(token: string, buyer_id: string): Promise<ReservationData> {
    const raw = await this.redis.get(`${KEY_PREFIX}${token}`);
    if (!raw) {
      throw new RpcException({
        statusCode: 410,
        message: 'Réservation expirée ou invalide — veuillez recommencer',
      });
    }

    const data: ReservationData = JSON.parse(raw);
    // Expiration logique vérifiée explicitement : la clé peut encore exister
    // pendant la marge de grâce (GRACE_SECONDS) réservée au cron de
    // restauration, elle ne doit pas rester utilisable pour autant.
    if (new Date(data.expires_at).getTime() <= Date.now()) {
      throw new RpcException({
        statusCode: 410,
        message: 'Réservation expirée ou invalide — veuillez recommencer',
      });
    }
    if (data.buyer_id !== buyer_id) {
      throw new RpcException({ statusCode: 403, message: 'Réservation invalide pour cet acheteur' });
    }

    return data;
  }

  async consume(token: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${token}`);
    await this.redis.zrem(INDEX_KEY, token);
  }

  /**
   * Retourne { success: true } plutôt que void — bug corrigé : c'est le
   * seul point de ce fichier exposé directement en @MessagePattern
   * (order.release_reservation) ; un retour void fait planter
   * firstValueFrom() côté gateway (RxJS EmptyError: "no elements in
   * sequence") alors que la libération elle-même s'est bien exécutée — le
   * client recevait une 500 malgré un succès réel.
   */
  async release(token: string): Promise<{ success: boolean }> {
    const raw = await this.redis.get(`${KEY_PREFIX}${token}`);
    if (!raw) return { success: true };

    const data: ReservationData = JSON.parse(raw);
    await this.rollback(data.items);
    await this.redis.del(`${KEY_PREFIX}${token}`);
    await this.redis.zrem(INDEX_KEY, token);
    return { success: true };
  }

  /**
   * Restaure le quota des réservations expirées jamais devenues une commande
   * (client parti sans payer) — appelée périodiquement par un cron. Sans
   * cette méthode, le quota décrémenté à la réservation ne revenait jamais :
   * la clé Redis expirait silencieusement sans déclencher de restauration.
   */
  async restoreExpiredReservations(): Promise<number> {
    const expiredTokens = await this.redis.zrangebyscore(INDEX_KEY, 0, Date.now());
    let restored = 0;
    for (const token of expiredTokens) {
      const raw = await this.redis.get(`${KEY_PREFIX}${token}`);
      if (raw) {
        const data: ReservationData = JSON.parse(raw);
        await this.rollback(data.items);
        await this.redis.del(`${KEY_PREFIX}${token}`);
        restored++;
      }
      // Retiré de l'index même si la clé avait déjà disparu (marge de grâce
      // dépassée) — cas résiduel qui ne devrait pas se produire en pratique.
      await this.redis.zrem(INDEX_KEY, token);
    }
    return restored;
  }

  /**
   * Restitue le quota de places pour des items déjà consommés (commande
   * créée, réservation Redis déjà supprimée) — utilisé lors de l'annulation
   * d'une commande, contrairement à release() qui vise une réservation
   * encore en attente de paiement.
   */
  async restoreItems(items: ReservationItem[]): Promise<void> {
    await this.rollback(items);
  }

  private async rollback(items: ReservationItem[]): Promise<void> {
    for (const item of items) {
      try {
        await firstValueFrom(
          this.eventClient.send('event.restore_quota', {
            id: item.ticket_category_id,
            quantity: item.quantity,
          }),
        );
      } catch {
        // Ignore les erreurs de rollback — ne pas masquer l'erreur principale
      }
    }
  }
}
