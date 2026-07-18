import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWrongEventScanResult1783700000002 implements MigrationInterface {
  name = 'AddWrongEventScanResult1783700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE tickets.scan_logs_result_enum ADD VALUE IF NOT EXISTS 'WRONG_EVENT'`,
    );
  }

  public async down(): Promise<void> {
    // Retirer une valeur d'un type ENUM Postgres nécessiterait de le
    // recréer entièrement — rollback volontairement non destructif,
    // cohérent avec le reste du repo.
  }
}
