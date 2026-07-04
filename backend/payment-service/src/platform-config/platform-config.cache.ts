/**
 * Coller ce fichier dans src/platform-config/platform-config.cache.ts de chaque service.
 * Nécessite ADMIN_SERVICE TCP client enregistré dans le module parent.
 */
import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

export interface PlatformConfig {
  tva_rate: number;
  free_ticket_fee_eur: number;
  commission_standard_percent: number;
  commission_large_event_percent: number;
  large_event_threshold: number;
  payout_delay_days: number;
  stripe_fee_percent: number;
  stripe_fee_fixed_eur: number;
  stock_reservation_ttl_seconds: number;
  cancel_deadline_hours: number;
  agent_session_hours: number;
  fill_thresholds: number[];
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const FALLBACK: PlatformConfig = {
  tva_rate: 0.20,
  free_ticket_fee_eur: 0.50,
  commission_standard_percent: 10,
  commission_large_event_percent: 8,
  large_event_threshold: 1000,
  payout_delay_days: 5,
  stripe_fee_percent: 2.9,
  stripe_fee_fixed_eur: 0.30,
  stock_reservation_ttl_seconds: 600,
  cancel_deadline_hours: 24,
  agent_session_hours: 12,
  fill_thresholds: [25, 50, 75, 100],
};

@Injectable()
export class PlatformConfigCache implements OnModuleInit {
  private readonly logger = new Logger(PlatformConfigCache.name);
  private cache: PlatformConfig = FALLBACK;
  private lastFetchedAt = 0;

  constructor(
    @Inject('ADMIN_SERVICE') private readonly adminClient: ClientProxy,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async get(): Promise<PlatformConfig> {
    if (Date.now() - this.lastFetchedAt > CACHE_TTL_MS) {
      await this.refresh();
    }
    return this.cache;
  }

  private async refresh(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.adminClient.send('admin.get_platform_config', {}),
      ) as PlatformConfig;
      this.cache = config;
      this.lastFetchedAt = Date.now();
    } catch (err) {
      this.logger.warn(`Impossible de récupérer la config plateforme, valeurs par défaut utilisées : ${err?.message}`);
    }
  }
}
