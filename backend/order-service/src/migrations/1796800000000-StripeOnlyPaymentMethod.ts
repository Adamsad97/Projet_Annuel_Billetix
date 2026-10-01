import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stripe devient le seul prestataire de paiement : les commandes sont
 * réglées par Stripe ou gratuites. Échoue volontairement si une commande
 * utilise encore un autre moyen de paiement.
 */
export class StripeOnlyPaymentMethod1796800000000 implements MigrationInterface {
  name = 'StripeOnlyPaymentMethod1796800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE orders.orders_payment_method_enum RENAME TO orders_payment_method_enum_old`);
    await queryRunner.query(`CREATE TYPE orders.orders_payment_method_enum AS ENUM ('STRIPE', 'FREE')`);
    await queryRunner.query(`ALTER TABLE orders.orders
      ALTER COLUMN payment_method TYPE orders.orders_payment_method_enum USING payment_method::text::orders.orders_payment_method_enum`);
    await queryRunner.query(`DROP TYPE orders.orders_payment_method_enum_old`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'ORANGE_MONEY', 'WAVE']) {
      await queryRunner.query(`ALTER TYPE orders.orders_payment_method_enum ADD VALUE IF NOT EXISTS '${value}'`);
    }
  }
}
