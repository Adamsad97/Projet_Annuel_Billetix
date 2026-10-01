import { plainToInstance, Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync } from "class-validator";

/** Configuration requise par la passerelle, vérifiée au démarrage (variable manquante ou invalide = arrêt). */
class GatewayEnvironment {
  @IsString()
  @MinLength(32, { message: "JWT_ACCESS_SECRET doit contenir au moins 32 caractères." })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL: string;

  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL: string;

  @IsString()
  @IsNotEmpty()
  MINIO_ENDPOINT: string;

  @IsString()
  @IsNotEmpty()
  MINIO_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  MINIO_SECRET_KEY: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  REQUEST_TIMEOUT_MS?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const env = plainToInstance(GatewayEnvironment, config, { enableImplicitConversion: false });
  const errors = validateSync(env, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(", ")}`)
      .join("\n");
    throw new Error(`Configuration invalide de l'API Gateway :\n${details}`);
  }
  return config;
}
