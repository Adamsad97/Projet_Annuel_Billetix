import { MigrationInterface, QueryRunner } from 'typeorm';

/** Contrôle de l'événement au scan : indisponible, trop tôt, trop tard. */
export class AddEventGateScanResults1796000000000 implements MigrationInterface {
  name = 'AddEventGateScanResults1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['EVENT_UNAVAILABLE', 'TOO_EARLY', 'TOO_LATE']) {
      await queryRunner.query(`ALTER TYPE tickets.scan_logs_result_enum ADD VALUE IF NOT EXISTS '${value}'`);
    }
  }

  public async down(): Promise<void> {
    // Retirer une valeur d'un type ENUM Postgres nécessiterait de le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
