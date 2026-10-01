import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

/** Configuration requise par pdf-service, vérifiée au démarrage (sans MinIO ni RabbitMQ, aucune facture). */
class PdfServiceEnvironment {
  @IsString() @IsNotEmpty() RABBITMQ_URL: string;

  @IsString() @IsNotEmpty() MINIO_ENDPOINT: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) MINIO_PORT: number;
  @IsString() @IsNotEmpty() MINIO_ACCESS_KEY: string;
  @IsString() @IsNotEmpty() MINIO_SECRET_KEY: string;
  @IsOptional() @IsString() MINIO_BUCKET_INVOICES?: string;
  @IsOptional() @IsString() MINIO_PUBLIC_ENDPOINT?: string;
  @IsOptional() @IsIn(['true', 'false']) MINIO_USE_SSL?: string;

  @IsOptional() @IsString() PUPPETEER_EXECUTABLE_PATH?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) HEALTH_PORT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(PdfServiceEnvironment, config));
  if (errors.length > 0) {
    const details = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Configuration invalide de pdf-service :\n${details}`);
  }
  return config;
}
