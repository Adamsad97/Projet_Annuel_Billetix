import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResaleFieldsToOrder1783700000001 implements MigrationInterface {
  name = 'AddResaleFieldsToOrder1783700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders
      ADD COLUMN is_resale boolean DEFAULT false NOT NULL,
      ADD COLUMN resale_id character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders
      DROP COLUMN IF EXISTS is_resale,
      DROP COLUMN IF EXISTS resale_id`);
  }
}
