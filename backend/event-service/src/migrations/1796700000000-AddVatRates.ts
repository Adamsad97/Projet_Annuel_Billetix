import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Taux de TVA choisis par événement dans une liste gérée par l'admin. Les
 * événements existants gardent le taux unique appliqué jusqu'ici (20 %).
 */
export class AddVatRates1796700000000 implements MigrationInterface {
  name = 'AddVatRates1796700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS events.vat_rates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      label varchar(80) NOT NULL,
      rate decimal(6,4) NOT NULL,
      is_default boolean NOT NULL DEFAULT false,
      is_active boolean NOT NULL DEFAULT true,
      display_order int NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`INSERT INTO events.vat_rates (label, rate, is_default)
      SELECT 'Taux normal', 0.2000, true WHERE NOT EXISTS (SELECT 1 FROM events.vat_rates)`);
    await queryRunner.query(`ALTER TABLE events.events
      ADD COLUMN IF NOT EXISTS vat_rate decimal(6,4) NOT NULL DEFAULT 0.2000,
      ADD COLUMN IF NOT EXISTS vat_rate_label varchar(80)`);
    await queryRunner.query(`UPDATE events.events SET vat_rate_label = 'Taux normal' WHERE vat_rate_label IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events DROP COLUMN IF EXISTS vat_rate_label, DROP COLUMN IF EXISTS vat_rate`);
    await queryRunner.query(`DROP TABLE IF EXISTS events.vat_rates`);
  }
}
