import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CDC §10.3 : "audit trail complet de toutes les actions sensibles" — jusqu'ici
 * seules les actions déclenchées par un admin étaient tracées. Ajoute 3 actions
 * que l'utilisateur déclenche lui-même sur son propre compte.
 */
export class AddUserSelfActionAuditActions1788700500000 implements MigrationInterface {
  name = 'AddUserSelfActionAuditActions1788700500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_2FA_ENABLED'`,
    );
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_2FA_DISABLED'`,
    );
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_PASSWORD_RESET'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
