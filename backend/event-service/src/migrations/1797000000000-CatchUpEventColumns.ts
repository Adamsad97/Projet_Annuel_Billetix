import { MigrationInterface, QueryRunner } from 'typeorm';

/** Rattrapage : colonnes présentes dans l'entité Event mais jamais migrées (validation but non lucratif, première vente). */
export class CatchUpEventColumns1797000000000 implements MigrationInterface {
  name = 'CatchUpEventColumns1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events
      ADD COLUMN IF NOT EXISTS non_profit_verified boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS non_profit_verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS non_profit_verified_by varchar,
      ADD COLUMN IF NOT EXISTS first_sale_notified boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events
      DROP COLUMN IF EXISTS first_sale_notified,
      DROP COLUMN IF EXISTS non_profit_verified_by,
      DROP COLUMN IF EXISTS non_profit_verified_at,
      DROP COLUMN IF EXISTS non_profit_verified`);
  }
}
