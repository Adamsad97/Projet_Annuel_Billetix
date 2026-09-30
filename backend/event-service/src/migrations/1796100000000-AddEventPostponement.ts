import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Report d'un événement : statut POSTPONED (date à venir), dates d'origine,
 * motif, annonce de la nouvelle date ; la demande de l'organisateur devient
 * une demande d'annulation ou de report (avec nouvelle date facultative).
 */
export class AddEventPostponement1796100000000 implements MigrationInterface {
  name = 'AddEventPostponement1796100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE events.events_status_enum ADD VALUE IF NOT EXISTS 'POSTPONED'`);
    await queryRunner.query(`ALTER TABLE events.events
      ADD COLUMN IF NOT EXISTS postponed_at timestamptz,
      ADD COLUMN IF NOT EXISTS postponement_reason text,
      ADD COLUMN IF NOT EXISTS original_start_date timestamptz,
      ADD COLUMN IF NOT EXISTS original_end_date timestamptz,
      ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE events.event_cancellation_requests_kind_enum AS ENUM ('CANCELLATION', 'POSTPONEMENT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`ALTER TABLE events.event_cancellation_requests
      ADD COLUMN IF NOT EXISTS kind events.event_cancellation_requests_kind_enum NOT NULL DEFAULT 'CANCELLATION',
      ADD COLUMN IF NOT EXISTS new_start_date timestamptz,
      ADD COLUMN IF NOT EXISTS new_end_date timestamptz`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.event_cancellation_requests
      DROP COLUMN IF EXISTS new_end_date,
      DROP COLUMN IF EXISTS new_start_date,
      DROP COLUMN IF EXISTS kind`);
    await queryRunner.query(`DROP TYPE IF EXISTS events.event_cancellation_requests_kind_enum`);
    await queryRunner.query(`ALTER TABLE events.events
      DROP COLUMN IF EXISTS rescheduled_at,
      DROP COLUMN IF EXISTS original_end_date,
      DROP COLUMN IF EXISTS original_start_date,
      DROP COLUMN IF EXISTS postponement_reason,
      DROP COLUMN IF EXISTS postponed_at`);
    // Une valeur d'enum PostgreSQL ne se retire pas : POSTPONED reste déclaré.
  }
}
