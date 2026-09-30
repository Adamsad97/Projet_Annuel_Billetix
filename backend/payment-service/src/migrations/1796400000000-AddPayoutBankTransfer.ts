import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reversements par virement bancaire : statut « À virer » et référence du virement. */
export class AddPayoutBankTransfer1796400000000 implements MigrationInterface {
  name = 'AddPayoutBankTransfer1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE payments.payouts_status_enum ADD VALUE IF NOT EXISTS 'TO_TRANSFER' AFTER 'PROCESSING'`);
    await queryRunner.query(`ALTER TABLE payments.payouts
      ADD COLUMN IF NOT EXISTS bank_transfer_reference varchar(140),
      ADD COLUMN IF NOT EXISTS transferred_by varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments.payouts
      DROP COLUMN IF EXISTS transferred_by,
      DROP COLUMN IF EXISTS bank_transfer_reference`);
  }
}
