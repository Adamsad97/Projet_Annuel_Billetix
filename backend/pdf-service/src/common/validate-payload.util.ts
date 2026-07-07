import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Validation manuelle (pas de ValidationPipe ici) : un payload PDF invalide
 * ne doit jamais être requeue (channel.nack(msg, false, true)) comme une
 * erreur transitoire (ex: Puppeteer indisponible) — il échouerait à
 * l'identique indéfiniment. L'appelant doit donc pouvoir distinguer
 * "payload structurellement invalide" (à écarter) de "erreur technique"
 * (à retenter), d'où cette validation explicite avant le bloc try/catch.
 */
export async function validatePayload<T extends object>(
  cls: ClassConstructor<T>,
  raw: unknown,
): Promise<{ valid: true; data: T } | { valid: false; message: string }> {
  const instance = plainToInstance(cls, raw);
  const errors = await validate(instance, { whitelist: true });

  if (errors.length === 0) {
    return { valid: true, data: instance };
  }

  const message = errors
    .map((e) => Object.values(e.constraints ?? {}).join(', '))
    .join(' | ');
  return { valid: false, message };
}
