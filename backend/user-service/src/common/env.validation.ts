import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, validateSync } from 'class-validator';

/** Configuration requise par user-service, vérifiée au démarrage (variable manquante ou mal formée = arrêt). */
class UserServiceEnvironment {
  @IsString() @IsNotEmpty() DATABASE_URL: string;

  // Chiffrement AES-256-GCM des IBAN : 32 octets en hexadécimal.
  @IsString()
  @Matches(/^[0-9a-fA-F]{64}$/, { message: 'IBAN_ENCRYPTION_KEY doit être une chaîne hexadécimale de 64 caractères (32 octets).' })
  IBAN_ENCRYPTION_KEY: string;

  @IsOptional() @IsIn(['development', 'production', 'test']) NODE_ENV?: string;
  @IsOptional() @IsIn(['true', 'false']) DB_LOGGING?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) HEALTH_PORT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(UserServiceEnvironment, config));
  if (errors.length > 0) {
    const details = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Configuration invalide de user-service :\n${details}`);
  }
  return config;
}
