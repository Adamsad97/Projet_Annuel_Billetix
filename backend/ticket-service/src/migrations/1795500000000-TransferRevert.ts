import { MigrationInterface, QueryRunner } from 'typeorm';

/** Annulation d'un transfert de billet par un admin (+ demandes de l'expéditeur). */
export class TransferRevert1795500000000 implements MigrationInterface {
  name = 'TransferRevert1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE tickets.ticket_transfers_status_enum AS ENUM ('ACTIVE', 'REVERTED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE tickets.ticket_transfers_revert_source_enum AS ENUM ('PHONE', 'PLATFORM');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`ALTER TABLE tickets.ticket_transfers
      ADD COLUMN IF NOT EXISTS status tickets.ticket_transfers_status_enum NOT NULL DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
      ADD COLUMN IF NOT EXISTS reverted_by varchar,
      ADD COLUMN IF NOT EXISTS reverted_by_email varchar,
      ADD COLUMN IF NOT EXISTS revert_reason text,
      ADD COLUMN IF NOT EXISTS revert_source tickets.ticket_transfers_revert_source_enum`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE tickets.transfer_revert_requests_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS tickets.transfer_revert_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      transfer_id varchar NOT NULL,
      ticket_id varchar NOT NULL,
      requested_by varchar NOT NULL,
      reason text NOT NULL,
      status tickets.transfer_revert_requests_status_enum NOT NULL DEFAULT 'PENDING',
      decided_by varchar,
      decided_by_email varchar,
      decision_reason text,
      decided_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const column of ['transfer_id', 'requested_by', 'status']) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS IDX_transfer_revert_requests_${column} ON tickets.transfer_revert_requests (${column})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.transfer_revert_requests`);
    await queryRunner.query(`ALTER TABLE tickets.ticket_transfers
      DROP COLUMN IF EXISTS revert_source, DROP COLUMN IF EXISTS revert_reason,
      DROP COLUMN IF EXISTS reverted_by_email, DROP COLUMN IF EXISTS reverted_by,
      DROP COLUMN IF EXISTS reverted_at, DROP COLUMN IF EXISTS status`);
  }
}
