import { MigrationInterface, QueryRunner } from 'typeorm';

// L'organisateur ne peut plus annuler seul : il demande l'annulation, un
// admin accepte ou refuse après échange de messages. L'admin peut aussi
// masquer un événement (hors catalogue, page publique indisponible).
export class EventCancellationRequests1795700000000 implements MigrationInterface {
  name = 'EventCancellationRequests1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.events
      ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS hidden_at timestamp without time zone,
      ADD COLUMN IF NOT EXISTS hidden_by character varying,
      ADD COLUMN IF NOT EXISTS hidden_reason text;`);

    await queryRunner.query(`CREATE TYPE events.event_cancellation_requests_status_enum
      AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');`);
    await queryRunner.query(`CREATE TABLE events.event_cancellation_requests (
      id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
      event_id character varying NOT NULL,
      organizer_id character varying NOT NULL,
      reason text NOT NULL,
      status events.event_cancellation_requests_status_enum NOT NULL DEFAULT 'PENDING',
      decided_at timestamp without time zone,
      decided_by character varying,
      created_at timestamp without time zone NOT NULL DEFAULT now(),
      updated_at timestamp without time zone NOT NULL DEFAULT now(),
      CONSTRAINT "PK_event_cancellation_requests_id" PRIMARY KEY (id)
    );`);
    await queryRunner.query(`CREATE INDEX "IDX_event_cancellation_requests_event_status"
      ON events.event_cancellation_requests (event_id, status);`);

    await queryRunner.query(`CREATE TYPE events.event_cancellation_messages_author_role_enum
      AS ENUM ('ORGANIZER', 'ADMIN');`);
    await queryRunner.query(`CREATE TABLE events.event_cancellation_messages (
      id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
      request_id uuid NOT NULL,
      author_id character varying NOT NULL,
      author_role events.event_cancellation_messages_author_role_enum NOT NULL,
      message text NOT NULL,
      created_at timestamp without time zone NOT NULL DEFAULT now(),
      CONSTRAINT "PK_event_cancellation_messages_id" PRIMARY KEY (id),
      CONSTRAINT "FK_event_cancellation_messages_request" FOREIGN KEY (request_id)
        REFERENCES events.event_cancellation_requests(id) ON DELETE CASCADE
    );`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE events.event_cancellation_messages;`);
    await queryRunner.query(`DROP TYPE events.event_cancellation_messages_author_role_enum;`);
    await queryRunner.query(`DROP TABLE events.event_cancellation_requests;`);
    await queryRunner.query(`DROP TYPE events.event_cancellation_requests_status_enum;`);
    await queryRunner.query(`ALTER TABLE events.events
      DROP COLUMN hidden_reason, DROP COLUMN hidden_by, DROP COLUMN hidden_at, DROP COLUMN is_hidden;`);
  }
}
