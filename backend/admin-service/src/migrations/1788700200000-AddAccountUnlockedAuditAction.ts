import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountUnlockedAuditAction1788700200000 implements MigrationInterface {
  name = 'AddAccountUnlockedAuditAction1788700200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_ACCOUNT_UNLOCKED'`,
    );
  }

  public async down(): Promise<void> {
    // Rollback non destructif : Postgres ne sait pas retirer une valeur d'ENUM sans recréer le type.
  }
}
