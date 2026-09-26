import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * QR code sans donnée sensible : le QR ne contient plus qu'un code aléatoire
 * éphémère (tickets.qr_display_codes), renouvelé toutes les quelques
 * secondes. L'image du QR fixe (qui encodait le jeton permanent du billet)
 * n'est plus générée ni stockée : colonne qr_code_url supprimée.
 */
export class QrDisplayCodes1795300000000 implements MigrationInterface {
  name = 'QrDisplayCodes1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS tickets.qr_display_codes (
      code varchar PRIMARY KEY,
      ticket_id varchar NOT NULL,
      ticket_token varchar NOT NULL,
      valid_from timestamptz NOT NULL,
      valid_until timestamptz NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_qr_display_codes_ticket_id ON tickets.qr_display_codes (ticket_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_qr_display_codes_valid_until ON tickets.qr_display_codes (valid_until)`,
    );
    await queryRunner.query(`ALTER TABLE tickets.tickets DROP COLUMN IF EXISTS qr_code_url`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tickets.tickets ADD COLUMN IF NOT EXISTS qr_code_url text`);
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.qr_display_codes`);
  }
}
