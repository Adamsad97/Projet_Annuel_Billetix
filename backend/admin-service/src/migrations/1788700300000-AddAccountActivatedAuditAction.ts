import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountActivatedAuditAction1788700300000 implements MigrationInterface {
  name = 'AddAccountActivatedAuditAction1788700300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_ACCOUNT_ACTIVATED'`,
    );
  }

  public async down(): Promise<void> {
    // Rollback non destructif : Postgres ne sait pas retirer une valeur d'ENUM sans recréer le type.
  }
}
