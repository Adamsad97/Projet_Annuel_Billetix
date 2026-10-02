import { MigrationInterface, QueryRunner } from 'typeorm';

/** Journal d'audit : export de ses données personnelles par l'utilisateur (RGPD, articles 15 et 20). */
export class AddUserDataExportedAuditAction1797100000000 implements MigrationInterface {
  name = 'AddUserDataExportedAuditAction1797100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_DATA_EXPORTED'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
