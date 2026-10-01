import { MigrationInterface, QueryRunner } from 'typeorm';

/** Taux de TVA de chaque commande (celui de son événement) ; 20 % pour l'existant. */
export class AddOrderVatRate1796700000000 implements MigrationInterface {
  name = 'AddOrderVatRate1796700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS vat_rate decimal(6,4) NOT NULL DEFAULT 0.2000`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders DROP COLUMN IF EXISTS vat_rate`);
  }
}
