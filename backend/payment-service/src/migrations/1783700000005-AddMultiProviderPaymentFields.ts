import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiProviderPaymentFields1783700000005 implements MigrationInterface {
  name = 'AddMultiProviderPaymentFields1783700000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE payments.payments_provider_enum ADD VALUE IF NOT EXISTS 'ORANGE_MONEY'`,
    );
    await queryRunner.query(
      `ALTER TYPE payments.payments_provider_enum ADD VALUE IF NOT EXISTS 'WAVE'`,
    );
    await queryRunner.query(
      `ALTER TABLE payments.payments ADD COLUMN provider_redirect_url text`,
    );
    await queryRunner.query(
      `ALTER TABLE payments.payments ADD COLUMN provider_notif_token character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payments.payments DROP COLUMN IF EXISTS provider_notif_token`,
    );
    await queryRunner.query(
      `ALTER TABLE payments.payments DROP COLUMN IF EXISTS provider_redirect_url`,
    );
    // Rollback partiel : Postgres ne sait pas retirer une valeur d'ENUM.
  }
}
