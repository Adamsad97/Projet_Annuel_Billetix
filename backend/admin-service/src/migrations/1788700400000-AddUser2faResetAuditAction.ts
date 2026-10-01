import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUser2faResetAuditAction1788700400000 implements MigrationInterface {
  name = 'AddUser2faResetAuditAction1788700400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_2FA_RESET'`,
    );
  }

  public async down(): Promise<void> {
    // Rollback non destructif : Postgres ne sait pas retirer une valeur d'ENUM sans recréer le type.
  }
}
