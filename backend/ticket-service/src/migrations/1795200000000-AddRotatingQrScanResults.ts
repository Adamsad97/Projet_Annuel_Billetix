import { MigrationInterface, QueryRunner } from 'typeorm';

/** QR code dynamique : résultats de scan « expiré » et « QR fixe refusé ». */
export class AddRotatingQrScanResults1795200000000 implements MigrationInterface {
  name = 'AddRotatingQrScanResults1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['EXPIRED', 'STATIC_REFUSED']) {
      await queryRunner.query(
        `ALTER TYPE tickets.scan_logs_result_enum ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Retirer une valeur d'un type ENUM Postgres nécessiterait de le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
