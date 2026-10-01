import { MigrationInterface, QueryRunner } from 'typeorm';

/** Traçabilité des accès aux billets (QR, PDF, facture : qui, quand, IP, appareil) en cas de contestation. */
export class AddTicketAccessAuditActions1795100000000 implements MigrationInterface {
  name = 'AddTicketAccessAuditActions1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['TICKET_QR_VIEWED', 'TICKET_PDF_DOWNLOADED', 'INVOICE_DOWNLOADED']) {
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
