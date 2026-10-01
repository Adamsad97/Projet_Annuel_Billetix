import { MigrationInterface, QueryRunner } from 'typeorm';

/** Couverture horizontale (16:9) des cartes d'événement, facultative. */
export class AddEventCover1796500000000 implements MigrationInterface {
  name = 'AddEventCover1796500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events ADD COLUMN IF NOT EXISTS cover_url varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events DROP COLUMN IF EXISTS cover_url`);
  }
}
