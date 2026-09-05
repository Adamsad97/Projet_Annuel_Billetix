import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CDC §7.2 : un admin doit pouvoir débloquer manuellement un reversement
 * bloqué (litige résolu plus tôt que le délai max de 30 jours, ou blocage
 * manuel devenu injustifié) et déclencher manuellement le versement d'un
 * reversement en attente, sans attendre le prochain cycle automatique
 * (10h00 chaque jour). Les handlers service existaient déjà
 * (PayoutService.unblock/process) mais n'étaient jamais exposés via l'API
 * admin — ajout des actions d'audit correspondantes.
 */
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
