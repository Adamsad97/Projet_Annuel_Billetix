import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plus de « session » d'agent : jamais utilisée par l'écran de scan, dont
 * l'accès est borné par l'affectation à l'événement et la fenêtre de scan
 * (scan_opens_before_minutes / scan_closes_after_minutes). last_activity_at
 * est conservée : elle date désormais le dernier scan de l'agent.
 */
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
