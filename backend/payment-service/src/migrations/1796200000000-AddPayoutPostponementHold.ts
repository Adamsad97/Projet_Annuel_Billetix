import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reversement en attente pendant le report d'un événement (nouvelle date à venir). */
export class AddPayoutPostponementHold1796200000000 implements MigrationInterface {
  name = 'AddPayoutPostponementHold1796200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payments.payouts ADD COLUMN IF NOT EXISTS on_hold_for_postponement boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments.payouts DROP COLUMN IF EXISTS on_hold_for_postponement`);
  }
}
