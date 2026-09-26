import { MigrationInterface, QueryRunner } from 'typeorm';

/** Historique des billets offerts (transfert gratuit entre comptes). */
export class TicketTransfers1795400000000 implements MigrationInterface {
  name = 'TicketTransfers1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS tickets.ticket_transfers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id varchar NOT NULL,
      ticket_reference varchar NOT NULL,
      event_id varchar NOT NULL,
      event_name varchar NOT NULL,
      event_start_at timestamptz NOT NULL,
      ticket_category_name varchar NOT NULL,
      from_user_id varchar NOT NULL,
      from_email varchar NOT NULL,
      from_first_name varchar NOT NULL,
      from_last_name varchar NOT NULL,
      from_holder_first_name varchar NOT NULL,
      from_holder_last_name varchar NOT NULL,
      to_user_id varchar NOT NULL,
      to_email varchar NOT NULL,
      to_holder_first_name varchar NOT NULL,
      to_holder_last_name varchar NOT NULL,
      ip_address varchar,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const column of ['ticket_id', 'event_id', 'from_user_id', 'to_user_id']) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS IDX_ticket_transfers_${column} ON tickets.ticket_transfers (${column})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.ticket_transfers`);
  }
}
