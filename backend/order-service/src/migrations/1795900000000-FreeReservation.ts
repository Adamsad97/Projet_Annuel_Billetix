import { MigrationInterface, QueryRunner } from 'typeorm';

// Réservation gratuite : moyen de paiement FREE et adresse de facturation facultative.
export class FreeReservation1795900000000 implements MigrationInterface {
  name = 'FreeReservation1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE orders.orders_payment_method_enum ADD VALUE IF NOT EXISTS 'FREE';`);
    await queryRunner.query(`ALTER TABLE orders.orders
      ALTER COLUMN billing_address_line1 DROP NOT NULL,
      ALTER COLUMN billing_city DROP NOT NULL,
      ALTER COLUMN billing_postal_code DROP NOT NULL,
      ALTER COLUMN billing_country DROP NOT NULL;`);
  }

  public async down(): Promise<void> {
    // Irréversible sans perte : des réservations gratuites peuvent exister
    // sans adresse, et Postgres ne sait pas retirer une valeur d'enum.
  }
}
