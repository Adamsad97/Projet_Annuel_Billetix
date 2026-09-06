import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CDC §3.2 : commission 0% « sur présentation d'un justificatif » pour les
 * événements à but non lucratif — jusqu'ici accordée automatiquement dès
 * que l'organisateur cochait is_non_profit, sans qu'aucun admin ne vérifie
 * le justificatif. Ajoute les actions d'audit de la nouvelle étape de
 * vérification explicite (EventService.verifyNonProfit).
 */
export class AddEventNonProfitAuditActions1788700700000 implements MigrationInterface {
  name = 'AddEventNonProfitAuditActions1788700700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'EVENT_NON_PROFIT_VERIFIED'`,
    );
    await queryRunner.query(
      `ALTER TYPE admin_logs.audit_logs_action_enum ADD VALUE IF NOT EXISTS 'EVENT_NON_PROFIT_REJECTED'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
