/**
 * Coller ce fichier dans src/platform-config/platform-config.cache.ts de chaque service.
 * Nécessite ADMIN_SERVICE TCP client enregistré dans le module parent.
 */
import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

export interface PlatformConfig {
  pdf_generation_max_retry_attempts: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const FALLBACK: PlatformConfig = {
  pdf_generation_max_retry_attempts: 5,
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
    } catch (error) {
      this.logger.warn(`Impossible de récupérer la config plateforme, valeurs par défaut utilisées : ${error?.message}`);
    }
  }
}
