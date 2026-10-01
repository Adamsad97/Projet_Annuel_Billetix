import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/** Validation manuelle avant le try/catch : un payload invalide est écarté, jamais retenté comme une erreur technique. */
export async function validatePayload<T extends object>(
  cls: ClassConstructor<T>,
  raw: unknown,
): Promise<{ valid: true; data: T } | { valid: false; message: string }> {
  const instance = plainToInstance(cls, raw);
  const errors = await validate(instance, { whitelist: true });

  if (errors.length === 0) {
    return { valid: true, data: instance };
  }

  return { valid: false, message: describe(errors).join(' | ') };
}

/** Champs refusés, y compris dans les objets imbriqués (lignes de facture). */
function describe(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((constraint) => `${field} : ${constraint}`);
    return [...own, ...describe(error.children ?? [], field)];
  });
}
