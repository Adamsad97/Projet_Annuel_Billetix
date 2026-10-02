import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'os';
import { RedisService } from '../redis/redis.service';

/**
 * Plusieurs exemplaires du service (cluster) déclenchent les mêmes crons : une seule exécution par créneau.
 * Clé posée une fois par créneau (SET NX) et jamais libérée : un exemplaire à l'horloge décalée ne rejoue pas la tâche.
 */
@Injectable()
export class JobLock {
  private readonly logger = new Logger(JobLock.name);

  constructor(private readonly redis: RedisService) {}

  /** Exécute `job` si aucun exemplaire ne l'a déjà fait pour ce créneau ; Redis indisponible → tâche sautée (jamais en double). */
  async runOncePerPeriod(name: string, periodSeconds: number, job: () => Promise<unknown>): Promise<boolean> {
    // Arrondi au créneau le plus proche : absorbe les décalages d'horloge autour de l'heure de déclenchement.
    const slot = Math.round(Date.now() / (periodSeconds * 1000));
    const key = `job-lock:order-service:${name}:${slot}`;

    let acquired: boolean;
    try {
      acquired = await this.redis.setnx(key, `${hostname()}:${process.pid}`, periodSeconds * 2);
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
