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
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement (DROP TYPE cascaderait sur audit_logs.action) —
    // rollback volontairement non destructif, cohérent avec le reste du repo.
  }
}
