import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stripe seul prestataire : commandes Stripe ou gratuites ; échoue si une commande utilise un autre moyen. */
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
