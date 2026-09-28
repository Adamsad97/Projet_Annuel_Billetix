import { MigrationInterface, QueryRunner } from 'typeorm';

// Remboursement partiel d'une commande (billet revendu) : la commande reste
// confirmée, seul le montant remboursé est enregistré et déduit des revenus.
export class AddOrderRefundedAmount1795800000000 implements MigrationInterface {
  name = 'AddOrderRefundedAmount1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders
      ADD COLUMN IF NOT EXISTS refunded_amount numeric(10,2) NOT NULL DEFAULT 0;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders DROP COLUMN refunded_amount;`);
  }
}
