import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plus de billet PDF : le billet n'existe que dans l'application (QR
 * éphémère) ; la preuve d'achat est la facture de la commande.
 */
export class DropTicketPdfUrl1795600000000 implements MigrationInterface {
  name = 'DropTicketPdfUrl1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tickets.tickets DROP COLUMN IF EXISTS pdf_url`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tickets.tickets ADD COLUMN IF NOT EXISTS pdf_url varchar`);
  }
}
