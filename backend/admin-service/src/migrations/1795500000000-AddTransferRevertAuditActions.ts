import { MigrationInterface, QueryRunner } from 'typeorm';

/** Journal d'audit : demande, annulation et refus d'annulation d'un transfert de billet. */
export class AddTransferRevertAuditActions1795500000000 implements MigrationInterface {
  name = 'AddTransferRevertAuditActions1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['TICKET_TRANSFER_REVERT_REQUESTED', 'TICKET_TRANSFER_REVERTED', 'TICKET_TRANSFER_REVERT_REJECTED']) {
      await queryRunner.query(
        `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
