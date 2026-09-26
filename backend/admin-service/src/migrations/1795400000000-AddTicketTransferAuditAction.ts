import { MigrationInterface, QueryRunner } from 'typeorm';

/** Journal d'audit : billet offert à un autre compte. */
export class AddTicketTransferAuditAction1795400000000 implements MigrationInterface {
  name = 'AddTicketTransferAuditAction1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'TICKET_TRANSFERRED'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
