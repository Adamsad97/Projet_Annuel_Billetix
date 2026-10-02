import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Serveur socket.io : origines limitées au site (FRONTEND_URL) et, si REDIS_URL est défini,
 * diffusion partagée entre plusieurs copies du service (cluster).
 */
export class RealtimeIoAdapter extends IoAdapter {
  private readonly redisLogger = new Logger(RealtimeIoAdapter.name);
  private redisAdapter: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: string[],
    private readonly redisUrl?: string,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    if (!this.redisUrl) return;
    const pub = new Redis(this.redisUrl, { lazyConnect: true });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    this.redisAdapter = createAdapter(pub, sub);
    this.redisLogger.log("Diffusion partagée via Redis activée");
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.allowedOrigins, credentials: true },
    });
    if (this.redisAdapter) server.adapter(this.redisAdapter);
    return server;
  }
}
