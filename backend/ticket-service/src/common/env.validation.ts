import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

/**
 * Configuration requise par ticket-service, vérifiée au démarrage : une
 * variable manquante arrête le service avec un message clair.
 */
class TicketServiceEnvironment {
  @IsString() @IsNotEmpty() DATABASE_URL: string;

  @IsOptional() @IsIn(['development', 'production', 'test']) NODE_ENV?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) HEALTH_PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) OFFLINE_SYNC_MAX_HOURS?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(TicketServiceEnvironment, config));
  if (errors.length > 0) {
    const details = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Configuration invalide de ticket-service :\n${details}`);
  }
  return config;
}
