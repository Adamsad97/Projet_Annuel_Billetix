import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomBytes } from 'crypto';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { RedisService } from '../redis/redis.service';

const KEY_PREFIX = 'reservation:';
// Index des réservations en cours (score = échéance) pour restaurer le stock des réservations expirées.
const INDEX_KEY = 'reservations:pending_index';
// Marge de grâce : la clé reste lisible par le cron un peu après l'échéance.
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
    await this.decrementAll(items);

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
    // Expiration vérifiée explicitement : la clé encore présente pendant la grâce n'est plus utilisable.
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

  /** Renvoie { success: true } (un void casse firstValueFrom) ; le DEL sert de verrou contre une double restauration. */
  async release(token: string): Promise<{ success: boolean }> {
    const raw = await this.redis.get(`${KEY_PREFIX}${token}`);
    if (!raw) return { success: true };

    const deleted = await this.redis.del(`${KEY_PREFIX}${token}`);
    await this.redis.zrem(INDEX_KEY, token);
    if (deleted > 0) {
      const data: ReservationData = JSON.parse(raw);
      await this.rollback(data.items);
    }
    return { success: true };
  }

  /** Restaure le quota des réservations expirées sans commande, appelée par un cron. */
  async restoreExpiredReservations(): Promise<number> {
    const expiredTokens = await this.redis.zrangebyscore(INDEX_KEY, 0, Date.now());
    let restored = 0;
    for (const token of expiredTokens) {
      const raw = await this.redis.get(`${KEY_PREFIX}${token}`);
      if (raw) {
        // Même verrou atomique que release() : restaure seulement si ce DEL a supprimé la clé.
        const deleted = await this.redis.del(`${KEY_PREFIX}${token}`);
        if (deleted > 0) {
          const data: ReservationData = JSON.parse(raw);
          await this.rollback(data.items);
          restored++;
        }
      }
      // Retiré de l'index même si la clé avait déjà disparu (marge de grâce
      // dépassée) — cas résiduel qui ne devrait pas se produire en pratique.
      await this.redis.zrem(INDEX_KEY, token);
    }
    return restored;
  }

  /** Reprend le stock d'une commande déjà annulée (paiement arrivé après l'abandon) ; 409 si les places sont reparties. */
  async retakeItems(items: ReservationItem[]): Promise<void> {
    await this.decrementAll(items);
  }

  /** Restitue le quota d'items déjà consommés, lors de l'annulation d'une commande. */
  async restoreItems(items: ReservationItem[]): Promise<void> {
    await this.rollback(items);
  }

  /** Décrémentation atomique du quota de chaque catégorie dans event-service, défaite en cas d'échec. */
  private async decrementAll(items: ReservationItem[]): Promise<void> {
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
      // L'erreur distante a la forme { statusCode, message } : on affiche le vrai message d'event-service.
      throw new RpcException({
        statusCode: quotaError?.statusCode ?? 409,
        message: quotaError?.message ?? 'Places insuffisantes',
      });
    }
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
