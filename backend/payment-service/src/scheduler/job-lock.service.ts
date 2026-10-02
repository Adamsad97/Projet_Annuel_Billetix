import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { hostname } from 'os';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Plusieurs exemplaires du service (cluster) déclenchent les mêmes crons : une seule exécution par créneau.
 * Clé posée une fois par créneau (SET NX) et jamais libérée : un exemplaire à l'horloge décalée ne rejoue pas la tâche.
 */
@Injectable()
export class JobLock {
  private readonly logger = new Logger(JobLock.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Exécute `job` si aucun exemplaire ne l'a déjà fait pour ce créneau ; Redis indisponible → tâche sautée (jamais en double). */
  async runOncePerPeriod(name: string, periodSeconds: number, job: () => Promise<unknown>): Promise<boolean> {
    // Arrondi au créneau le plus proche : absorbe les décalages d'horloge autour de l'heure de déclenchement.
    const slot = Math.round(Date.now() / (periodSeconds * 1000));
    const key = `job-lock:payment-service:${name}:${slot}`;

    let acquired: boolean;
    try {
      acquired = (await this.redis.set(key, `${hostname()}:${process.pid}`, 'EX', periodSeconds * 2, 'NX')) === 'OK';
    } catch (error) {
      this.logger.warn(`Tâche « ${name} » sautée, verrou Redis indisponible : ${(error as Error)?.message}`);
      return false;
    }
    if (!acquired) {
      this.logger.debug(`Tâche « ${name} » déjà prise par un autre exemplaire pour ce créneau`);
      return false;
    }

    await job();
    return true;
  }
}
