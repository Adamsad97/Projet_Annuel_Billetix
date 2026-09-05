import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountActivatedAuditAction1788700300000 implements MigrationInterface {
  name = 'AddAccountActivatedAuditAction1788700300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'USER_ACCOUNT_ACTIVATED'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement (DROP TYPE cascaderait sur audit_logs.action) —
    // rollback volontairement non destructif, cohérent avec le reste du repo.
  }
}
