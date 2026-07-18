import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventEndAtToPayout1783700000004 implements MigrationInterface {
  name = 'AddEventEndAtToPayout1783700000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payments.payouts ADD COLUMN event_end_at timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE payments.payouts DROP COLUMN IF EXISTS event_end_at`,
    );
  }
}
