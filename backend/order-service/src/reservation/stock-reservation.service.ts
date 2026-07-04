import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomBytes } from 'crypto';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { RedisService } from '../redis/redis.service';

const KEY_PREFIX = 'reservation:';

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
    } catch (err) {
      // Rollback des décrémentations déjà faites
      await this.rollback(decremented);
      throw new RpcException({
        statusCode: 409,
        message: err?.error?.message ?? 'Places insuffisantes',
      });
    }

    const config = await this.platformConfig.get();
    const ttl = config.stock_reservation_ttl_seconds;
    const token = randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + ttl * 1000);

    const data: ReservationData = { buyer_id, event_id, items, expires_at: expires_at.toISOString() };
    await this.redis.set(`${KEY_PREFIX}${token}`, JSON.stringify(data), ttl);

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
    if (data.buyer_id !== buyer_id) {
      throw new RpcException({ statusCode: 403, message: 'Réservation invalide pour cet acheteur' });
    }

    return data;
  }

  async consume(token: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${token}`);
  }

  async release(token: string): Promise<void> {
    const raw = await this.redis.get(`${KEY_PREFIX}${token}`);
    if (!raw) return;

    const data: ReservationData = JSON.parse(raw);
    await this.rollback(data.items);
    await this.redis.del(`${KEY_PREFIX}${token}`);
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
