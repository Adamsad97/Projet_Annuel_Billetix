import { MigrationInterface, QueryRunner } from 'typeorm';

/** Journal d'audit : modification d'un paramètre de la plateforme. */
export class AddPlatformSettingAudit1795600000000 implements MigrationInterface {
  name = 'AddPlatformSettingAudit1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'PLATFORM_SETTING_UPDATED'`,
    );
    await queryRunner.query(`ALTER TYPE admin_logs.audit_logs_entity_type_enum ADD VALUE IF NOT EXISTS 'SETTING'`);
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
