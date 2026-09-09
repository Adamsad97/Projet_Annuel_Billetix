import { MigrationInterface, QueryRunner } from 'typeorm';

// Table de correspondance jeton QR opaque -> billet. Le QR n'embarque plus
// aucune information exploitable (ticket_id/event_id/horodatage signés) :
// une valeur aléatoire pure n'a de sens que via cette table côté serveur.
// Conserve aussi l'historique des jetons remplacés (is_current = false)
// pour distinguer un billet revendu (SUPERSEDED) d'un code jamais émis
// (INVALID) — cf. verifyQr() dans ticket.service.ts.
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
