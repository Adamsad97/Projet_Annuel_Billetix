import { MigrationInterface, QueryRunner } from 'typeorm';

// Correspondance jeton QR opaque → billet, avec l'historique des jetons remplacés (SUPERSEDED vs INVALID).
export class AddQrTokenHistory1789000000000 implements MigrationInterface {
  name = 'AddQrTokenHistory1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE tickets.qr_token_history (
      token character varying PRIMARY KEY,
      ticket_id character varying NOT NULL,
      is_current boolean DEFAULT true NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );`);
    await queryRunner.query(
      `CREATE INDEX IDX_qr_token_history_ticket_id ON tickets.qr_token_history (ticket_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.qr_token_history;`);
  }
}
