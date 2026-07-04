import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1720051200001 implements MigrationInterface {
  name = 'InitSchema1720051200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE users.organizer_profiles_kyc_status_enum AS ENUM (
    'PENDING',
    'SUBMITTED',
    'VERIFIED',
    'REJECTED'
);`);
    await queryRunner.query(`CREATE TABLE users.buyer_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying NOT NULL,
    billing_address_line1 character varying,
    billing_address_line2 character varying,
    billing_city character varying,
    billing_postal_code character varying,
    billing_country character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE users.organizer_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying NOT NULL,
    display_name character varying NOT NULL,
    description text,
    logo_url character varying,
    website_url character varying,
    social_instagram character varying,
    social_facebook character varying,
    social_twitter character varying,
    social_youtube character varying,
    iban_encrypted character varying,
    iban_iv character varying,
    iban_tag character varying,
    bank_owner_name character varying,
    stripe_connect_account_id character varying,
    stripe_connect_onboarded boolean DEFAULT false NOT NULL,
    kyc_status users.organizer_profiles_kyc_status_enum DEFAULT 'PENDING'::users.organizer_profiles_kyc_status_enum NOT NULL,
    kyc_submitted_at timestamp without time zone,
    kyc_verified_at timestamp without time zone,
    kyc_rejected_reason text,
    kyc_document_url character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`ALTER TABLE ONLY users.buyer_profiles
    ADD CONSTRAINT "PK_6e8158bfa9ea36f4a16df9c1f41" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY users.organizer_profiles
    ADD CONSTRAINT "PK_8e09aa532f012ff2298b819c04a" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY users.buyer_profiles
    ADD CONSTRAINT "UQ_8ef06dd95facdc3db875b449baf" UNIQUE (user_id);`);
    await queryRunner.query(`ALTER TABLE ONLY users.organizer_profiles
    ADD CONSTRAINT "UQ_ea845db509307bc33365054eacc" UNIQUE (user_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users.organizer_profiles CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS users.buyer_profiles CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS users.organizer_profiles_kyc_status_enum`);
  }
}
