import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

/** Configuration requise par realtime-service, vérifiée au démarrage (variable manquante = arrêt avec message clair). */
class RealtimeServiceEnvironment {
  @IsString() @IsNotEmpty() RABBITMQ_URL: string;
  @IsString() @MinLength(32, { message: 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères.' }) JWT_ACCESS_SECRET: string;
  /** Origines autorisées à se connecter (adresse du site), séparées par des virgules. */
  @IsString() @IsNotEmpty() FRONTEND_URL: string;

  @IsOptional() @IsString() REDIS_URL?: string;
  @IsOptional() @IsString() EVENT_SERVICE_HOST?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) EVENT_SERVICE_PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(RealtimeServiceEnvironment, config));
  if (errors.length > 0) {
    const details = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Configuration invalide de realtime-service :\n${details}`);
  }
  return config;
}
