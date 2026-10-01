import { MigrationInterface, QueryRunner } from 'typeorm';

// Préférences de notification de l'acheteur en jsonb, pour ajouter des préférences sans migration.
export class AddNotificationPreferences1788800000000 implements MigrationInterface {
  name = 'AddNotificationPreferences1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users.buyer_profiles
      ADD COLUMN notification_preferences jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users.buyer_profiles
      DROP COLUMN notification_preferences;
    `);
  }
}
