import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

/** Sous-ensemble de la config plateforme utile à auth-service, réglable par l'admin, cache 5 min avec repli. */
export interface AuthPlatformConfig {
  account_lockout_threshold: number;
  account_lockout_duration_minutes: number;
  password_min_length: number;
  password_max_age_days: number;
  magic_link_ttl_minutes: number;
  minimum_signup_age: number;
  session_idle_timeout_minutes: number;
  session_refresh_grace_seconds: number;
  session_max_duration_hours: number;
  agent_invitation_hours: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const FALLBACK: AuthPlatformConfig = {
  account_lockout_threshold: 5,
  account_lockout_duration_minutes: 15,
  password_min_length: 12,
  password_max_age_days: 60,
  magic_link_ttl_minutes: 15,
  minimum_signup_age: 18,
  session_idle_timeout_minutes: 30,
  session_refresh_grace_seconds: 30,
  session_max_duration_hours: 12,
  agent_invitation_hours: 72,
};

@Injectable()
export class PlatformConfigCache implements OnModuleInit {
  private readonly logger = new Logger(PlatformConfigCache.name);
  private cache: AuthPlatformConfig = FALLBACK;
  private lastFetchedAt = 0;

  constructor(
    @Inject('ADMIN_SERVICE') private readonly adminClient: ClientProxy,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async get(): Promise<AuthPlatformConfig> {
    if (Date.now() - this.lastFetchedAt > CACHE_TTL_MS) {
      await this.refresh();
    }
    return this.cache;
  }

  private async refresh(): Promise<void> {
    try {
      const config = (await firstValueFrom(
        this.adminClient.send('admin.get_platform_config', {}),
      )) as AuthPlatformConfig;
      this.cache = config;
      this.lastFetchedAt = Date.now();
    } catch (refreshError) {
      this.logger.warn(
        `Impossible de récupérer la config plateforme, valeurs par défaut utilisées : ${refreshError?.message}`,
      );
    }
  }
}
