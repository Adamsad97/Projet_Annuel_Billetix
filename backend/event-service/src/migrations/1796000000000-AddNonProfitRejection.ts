import { MigrationInterface, QueryRunner } from 'typeorm';

// Refus du justificatif « à but non lucratif » : daté et motivé (il se
// confondait jusqu'ici avec l'état « en attente »).
export class AddNonProfitRejection1796000000000 implements MigrationInterface {
  name = 'AddNonProfitRejection1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events
      ADD COLUMN IF NOT EXISTS non_profit_rejected_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS non_profit_rejection_reason text;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events
      DROP COLUMN IF EXISTS non_profit_rejection_reason,
      DROP COLUMN IF EXISTS non_profit_rejected_at;`);
  }
}
