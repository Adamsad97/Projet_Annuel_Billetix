import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reversements par virement bancaire : export SEPA, confirmation et annulation d'un virement. */
export class AddBankTransferAuditActions1796400000000 implements MigrationInterface {
  name = 'AddBankTransferAuditActions1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const action of ['PAYOUTS_SEPA_EXPORTED', 'PAYOUT_TRANSFER_CONFIRMED', 'PAYOUT_TRANSFER_CANCELLED']) {
      await queryRunner.query(`ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS '${action}'`);
    }
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le recréer.
  }
}
