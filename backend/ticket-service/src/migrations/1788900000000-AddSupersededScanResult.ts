import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupersededScanResult1788900000000 implements MigrationInterface {
  name = 'AddSupersededScanResult1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE tickets.scan_logs_result_enum ADD VALUE IF NOT EXISTS 'SUPERSEDED'`,
    );
  }

  public async down(): Promise<void> {
    // Rollback non destructif : Postgres ne sait pas retirer une valeur d'ENUM sans recréer le type.
  }
}
