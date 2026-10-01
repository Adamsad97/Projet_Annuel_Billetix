import { MigrationInterface, QueryRunner } from 'typeorm';

// Adresse lisible des pages publiques, attribuée aux événements existants au démarrage du service.
export class AddEventSlug1795900000000 implements MigrationInterface {
  name = 'AddEventSlug1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events ADD COLUMN IF NOT EXISTS slug character varying(100);`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_events_slug" ON events.events (slug);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS events."UQ_events_slug";`);
    await queryRunner.query(`ALTER TABLE events.events DROP COLUMN IF EXISTS slug;`);
  }
}
