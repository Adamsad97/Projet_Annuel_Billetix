import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWrongEventScanResult1783700000002 implements MigrationInterface {
  name = 'AddWrongEventScanResult1783700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE tickets.scan_logs_result_enum ADD VALUE IF NOT EXISTS 'WRONG_EVENT'`,
    );
  }

  public async down(): Promise<void> {
    // Rollback non destructif : Postgres ne sait pas retirer une valeur d'ENUM sans recréer le type.
  }
}
