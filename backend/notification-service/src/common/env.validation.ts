import { plainToInstance, Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

/** Configuration requise par notification-service, vérifiée au démarrage (sans SMTP valide, aucun email ne part). */
class NotificationServiceEnvironment {
  @IsString() @IsNotEmpty() RABBITMQ_URL: string;
  @IsString() @IsNotEmpty() FRONTEND_URL: string;

  @IsString() @IsNotEmpty() SMTP_HOST: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) SMTP_PORT: number;
  @IsOptional() @IsString() SMTP_USER?: string;
  @IsOptional() @IsString() SMTP_PASS?: string;

  @IsEmail({}, { message: "EMAIL_FROM doit être une adresse email valide." }) EMAIL_FROM: string;
  @IsOptional() @IsString() EMAIL_FROM_NAME?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) HEALTH_PORT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(NotificationServiceEnvironment, config));
  if (errors.length > 0) {
    const details = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Configuration invalide de notification-service :\n${details}`);
  }
  return config;
}
