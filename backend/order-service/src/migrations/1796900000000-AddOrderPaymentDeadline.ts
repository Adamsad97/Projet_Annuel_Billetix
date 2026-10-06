import { MigrationInterface, QueryRunner } from 'typeorm';

/** Échéance de paiement de la commande, reprise de la réservation ; vide pour l'existant. */
export class AddOrderPaymentDeadline1796900000000 implements MigrationInterface {
  name = 'AddOrderPaymentDeadline1796900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS payment_deadline timestamp`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders DROP COLUMN IF EXISTS payment_deadline`);
  }
}
