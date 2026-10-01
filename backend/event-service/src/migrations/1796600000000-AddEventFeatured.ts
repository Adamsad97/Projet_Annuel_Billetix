import { MigrationInterface, QueryRunner } from 'typeorm';

/** Événements mis « À la une » de l'accueil par un admin. */
export class AddEventFeatured1796600000000 implements MigrationInterface {
  name = 'AddEventFeatured1796600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events
      ADD COLUMN IF NOT EXISTS featured_at timestamptz,
      ADD COLUMN IF NOT EXISTS featured_by varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events
      DROP COLUMN IF EXISTS featured_by,
      DROP COLUMN IF EXISTS featured_at`);
  }
}
