import { MigrationInterface, QueryRunner } from 'typeorm';

/** Protège le rappel J-1 contre un double envoi (redémarrage, ré-exécution manuelle). */
export class AddReminderSentToOrder1788700800000 implements MigrationInterface {
  name = 'AddReminderSentToOrder1788700800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders
      ADD COLUMN reminder_sent boolean DEFAULT false NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders.orders
      DROP COLUMN IF EXISTS reminder_sent`);
  }
}
