import { MigrationInterface, QueryRunner } from 'typeorm';

/** Journal d'audit : création, modification et suppression des catégories. */
export class AddCategoryAuditEntity1796700000000 implements MigrationInterface {
  name = 'AddCategoryAuditEntity1796700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE admin_logs.audit_logs_entity_type_enum ADD VALUE IF NOT EXISTS 'CATEGORY'`);
  }

  public async down(): Promise<void> {
    // Postgres ne permet pas de retirer une valeur d'un type ENUM sans le recréer.
  }
}
