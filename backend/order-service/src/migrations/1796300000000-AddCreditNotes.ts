import { MigrationInterface, QueryRunner } from 'typeorm';

/** Avoirs des commandes remboursées, numérotés sans trou par une séquence. */
export class AddCreditNotes1796300000000 implements MigrationInterface {
  name = 'AddCreditNotes1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS orders.credit_note_seq`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS orders.credit_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      number varchar NOT NULL UNIQUE,
      order_id varchar NOT NULL,
      amount_ht decimal(10,2) NOT NULL,
      tva_amount decimal(10,2) NOT NULL,
      fees_amount decimal(10,2) NOT NULL DEFAULT 0,
      amount_ttc decimal(10,2) NOT NULL,
      reason text NOT NULL,
      pdf_url varchar,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_credit_notes_order_id" ON orders.credit_notes (order_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS orders.credit_notes`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS orders.credit_note_seq`);
  }
}
