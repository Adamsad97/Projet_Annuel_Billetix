import { MigrationInterface, QueryRunner } from 'typeorm';

/** Frais des billets gratuits portés par le reversement, et compensation des montants dus par l'organisateur. */
export class AddPayoutNetting1796300000000 implements MigrationInterface {
  name = 'AddPayoutNetting1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments.payouts
      ADD COLUMN IF NOT EXISTS free_ticket_fees_amount decimal(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS offset_amount decimal(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS settled_by_payout_id varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments.payouts
      DROP COLUMN IF EXISTS settled_by_payout_id,
      DROP COLUMN IF EXISTS offset_amount,
      DROP COLUMN IF EXISTS free_ticket_fees_amount`);
  }
}
