import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

/**
 * Configuration requise par order-service, vérifiée au démarrage : une
 * variable manquante arrête le service avec un message clair.
 */
class OrderServiceEnvironment {
  @IsString() @IsNotEmpty() DATABASE_URL: string;
  @IsString() @IsNotEmpty() RABBITMQ_URL: string;
  @IsString() @IsNotEmpty() REDIS_URL: string;

  @IsOptional() @IsIn(['development', 'production', 'test']) NODE_ENV?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) HEALTH_PORT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(OrderServiceEnvironment, config));
  if (errors.length > 0) {
    const details = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Configuration invalide d'order-service :\n${details}`);
  }
  return config;
}
