import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentFailureReason1783700000003 implements MigrationInterface {
  name = 'AddPaymentFailureReason1783700000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payments.payments ADD COLUMN failure_reason text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payments.payments DROP COLUMN IF EXISTS failure_reason`,
    );
  }
}
