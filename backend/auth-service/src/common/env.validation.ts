import { plainToInstance, Type } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync } from "class-validator";

/**
 * Configuration requise par auth-service, vérifiée au démarrage : une
 * variable manquante ou trop faible arrête le service avec un message clair.
 */
class AuthServiceEnvironment {
  @IsString() @IsNotEmpty() DATABASE_URL: string;
  @IsString() @IsNotEmpty() REDIS_URL: string;

  @IsString() @MinLength(32, { message: "JWT_ACCESS_SECRET doit contenir au moins 32 caractères." })
  JWT_ACCESS_SECRET: string;

  @IsString() @MinLength(32, { message: "JWT_REFRESH_SECRET doit contenir au moins 32 caractères." })
  JWT_REFRESH_SECRET: string;

  @IsOptional() @IsString() JWT_ACCESS_EXPIRES_IN?: string;
  @IsOptional() @IsString() JWT_REFRESH_EXPIRES_IN?: string;

  // Premier super admin (facultatif, cf. AdminBootstrapService).
  @IsOptional() @IsEmail() BOOTSTRAP_ADMIN_EMAIL?: string;
  @IsOptional() @IsString() @MinLength(12, { message: "BOOTSTRAP_ADMIN_PASSWORD doit contenir au moins 12 caractères." })
  BOOTSTRAP_ADMIN_PASSWORD?: string;

  @IsOptional() @IsIn(["development", "production", "test"]) NODE_ENV?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) HEALTH_PORT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(AuthServiceEnvironment, config));
  const messages = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(", ")}`);
  // Un même secret pour les deux jetons permettrait d'utiliser un jeton de
  // rafraîchissement comme jeton d'accès.
  if (config.JWT_ACCESS_SECRET && config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    messages.push("  - JWT_REFRESH_SECRET : doit être différent de JWT_ACCESS_SECRET.");
  }
  if (messages.length > 0) {
    throw new Error(`Configuration invalide d'auth-service :\n${messages.join("\n")}`);
  }
  return config;
}
