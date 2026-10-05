import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

/** Configuration requise par ticket-service, vérifiée au démarrage (variable manquante = arrêt avec message clair). */
class TicketServiceEnvironment {
  @IsString() @IsNotEmpty() DATABASE_URL: string;
  // Verrou des tâches planifiées : une seule exécution par créneau quand le service tourne en plusieurs exemplaires.
  @IsString() @IsNotEmpty() REDIS_URL: string;
  // Clé privée Ed25519 (PKCS#8, DER, base64) qui signe les QR codes.
  @IsString() @IsNotEmpty() QR_SIGNING_PRIVATE_KEY: string;

  @IsOptional() @IsIn(['development', 'production', 'test']) NODE_ENV?: string;
  @IsOptional() @IsIn(['true', 'false']) DB_LOGGING?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) HEALTH_PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) OFFLINE_SYNC_MAX_HOURS?: number;
  @IsOptional() @IsString() EVENT_SERVICE_HOST?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) EVENT_SERVICE_PORT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(TicketServiceEnvironment, config));
  if (errors.length > 0) {
    const details = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Configuration invalide de ticket-service :\n${details}`);
  }
  return config;
}
