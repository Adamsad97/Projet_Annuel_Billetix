import { MigrationInterface, QueryRunner } from 'typeorm';

/** Scan d'un billet mis en revente : résultat distinct d'un QR invalide. */
export class AddForResaleScanResult1796100000000 implements MigrationInterface {
  name = 'AddForResaleScanResult1796100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE tickets.scan_logs_result_enum ADD VALUE IF NOT EXISTS 'FOR_RESALE'`);
  }

  public async down(): Promise<void> {
    // Retirer une valeur d'un type ENUM Postgres nécessiterait de le
    // recréer entièrement — rollback volontairement non destructif.
  }
}
