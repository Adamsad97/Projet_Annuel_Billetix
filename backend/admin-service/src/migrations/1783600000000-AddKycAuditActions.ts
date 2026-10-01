import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKycAuditActions1783600000000 implements MigrationInterface {
  name = 'AddKycAuditActions1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'KYC_APPROVED'`,
    );
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'KYC_REJECTED'`,
    );
  }

  public async down(): Promise<void> {
    // Rollback non destructif : Postgres ne sait pas retirer une valeur d'ENUM sans recréer le type.
  }
}
