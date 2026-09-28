import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, validateSync } from 'class-validator';

/**
 * Configuration requise par payment-service, vérifiée au démarrage. Les
 * moyens de paiement facultatifs (PayPal, Orange Money, Wave) ne sont exigés
 * que s'ils sont utilisés : leurs clés restent optionnelles ici.
 */
class PaymentServiceEnvironment {
  @IsString() @IsNotEmpty() DATABASE_URL: string;
  @IsString() @IsNotEmpty() RABBITMQ_URL: string;
  @IsString() @IsNotEmpty() FRONTEND_URL: string;

  @IsString()
  @Matches(/^sk_(test|live)_/, { message: 'STRIPE_SECRET_KEY doit être une clé secrète Stripe (sk_test_… ou sk_live_…).' })
  STRIPE_SECRET_KEY: string;

  @IsString()
  @Matches(/^whsec_/, { message: 'STRIPE_WEBHOOK_SECRET doit commencer par whsec_.' })
  STRIPE_WEBHOOK_SECRET: string;

  @IsOptional() @IsIn(['development', 'production', 'test']) NODE_ENV?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) HEALTH_PORT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors = validateSync(plainToInstance(PaymentServiceEnvironment, config));
  if (errors.length > 0) {
    const details = errors.map((error) => `  - ${error.property} : ${Object.values(error.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Configuration invalide de payment-service :\n${details}`);
  }
  return config;
}
