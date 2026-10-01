import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stripe seul prestataire : retire PayPal, Orange Money et Wave ; échoue si un paiement les utilise encore. */
export class StripeOnlyPayments1796800000000 implements MigrationInterface {
  name = 'StripeOnlyPayments1796800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments.payments
      DROP COLUMN IF EXISTS provider_redirect_url,
      DROP COLUMN IF EXISTS provider_notif_token`);
    await queryRunner.query(`ALTER TABLE payments.payments ALTER COLUMN provider DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE payments.payments_provider_enum RENAME TO payments_provider_enum_old`);
    await queryRunner.query(`CREATE TYPE payments.payments_provider_enum AS ENUM ('STRIPE')`);
    await queryRunner.query(`ALTER TABLE payments.payments
      ALTER COLUMN provider TYPE payments.payments_provider_enum USING provider::text::payments.payments_provider_enum`);
    await queryRunner.query(`ALTER TABLE payments.payments ALTER COLUMN provider SET DEFAULT 'STRIPE'`);
    await queryRunner.query(`DROP TYPE payments.payments_provider_enum_old`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE payments.payments_provider_enum ADD VALUE IF NOT EXISTS 'PAYPAL'`);
    await queryRunner.query(`ALTER TYPE payments.payments_provider_enum ADD VALUE IF NOT EXISTS 'ORANGE_MONEY'`);
    await queryRunner.query(`ALTER TYPE payments.payments_provider_enum ADD VALUE IF NOT EXISTS 'WAVE'`);
    await queryRunner.query(`ALTER TABLE payments.payments
      ADD COLUMN IF NOT EXISTS provider_redirect_url text,
      ADD COLUMN IF NOT EXISTS provider_notif_token character varying`);
  }
}
