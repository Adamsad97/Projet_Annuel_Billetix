import { MigrationInterface, QueryRunner } from 'typeorm';

/** Moyen de reversement (virement sur IBAN par défaut, Stripe en option) et date du dernier changement d'IBAN. */
export class AddPayoutMethodAndIbanChange1796400000000 implements MigrationInterface {
  name = 'AddPayoutMethodAndIbanChange1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE users.organizer_profiles_payout_method_enum AS ENUM ('BANK_TRANSFER', 'STRIPE');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`ALTER TABLE users.organizer_profiles
      ADD COLUMN IF NOT EXISTS payout_method users.organizer_profiles_payout_method_enum NOT NULL DEFAULT 'BANK_TRANSFER',
      ADD COLUMN IF NOT EXISTS iban_updated_at timestamptz`);
    // Organisateurs déjà reliés à Stripe : ils gardent le versement automatique.
    await queryRunner.query(`UPDATE users.organizer_profiles SET payout_method = 'STRIPE' WHERE stripe_connect_onboarded = true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users.organizer_profiles DROP COLUMN IF EXISTS iban_updated_at, DROP COLUMN IF EXISTS payout_method`);
    await queryRunner.query(`DROP TYPE IF EXISTS users.organizer_profiles_payout_method_enum`);
  }
}
