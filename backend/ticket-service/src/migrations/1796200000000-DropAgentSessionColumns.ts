import { MigrationInterface, QueryRunner } from 'typeorm';

/** Plus de session d'agent ; last_activity_at date désormais son dernier scan. */
export class DropAgentSessionColumns1796200000000 implements MigrationInterface {
  name = 'DropAgentSessionColumns1796200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tickets.control_agents
        DROP COLUMN IF EXISTS session_token,
        DROP COLUMN IF EXISTS session_started_at,
        DROP COLUMN IF EXISTS session_expires_at
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tickets.control_agents
        ADD COLUMN IF NOT EXISTS session_token varchar,
        ADD COLUMN IF NOT EXISTS session_started_at timestamp,
        ADD COLUMN IF NOT EXISTS session_expires_at timestamp
    `);
  }
}
