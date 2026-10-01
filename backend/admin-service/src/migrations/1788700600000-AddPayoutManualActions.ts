import { MigrationInterface, QueryRunner } from 'typeorm';

/** CDC §7.2 : actions d'audit du déblocage et du versement manuels d'un reversement par un admin. */
export class AddPayoutManualActions1788700600000 implements MigrationInterface {
  name = 'AddPayoutManualActions1788700600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'PAYOUT_UNBLOCKED'`,
    );
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'PAYOUT_PROCESSED_MANUALLY'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
