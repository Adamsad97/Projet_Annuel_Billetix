import { MigrationInterface, QueryRunner } from 'typeorm';

// Préférences de notification de l'acheteur (emails optionnels — rappel
// événement, suivi revente, alerte remplissage, recommandations,
// newsletter). Stockage en jsonb plutôt qu'une colonne par préférence : la
// liste des préférences disponibles est amenée à évoluer côté frontend sans
// nécessiter de nouvelle migration à chaque ajout. Absence de clé = valeur
// par défaut du frontend (lib/mock/notification-prefs.ts) appliquée.
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
