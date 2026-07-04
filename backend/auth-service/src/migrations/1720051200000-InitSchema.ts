import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1720051200000 implements MigrationInterface {
  name = 'InitSchema1720051200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE auth.users_oauth_provider_enum AS ENUM (
    'GOOGLE',
    'FACEBOOK'
);`);
    await queryRunner.query(`CREATE TYPE auth.users_role_enum AS ENUM (
    'BUYER',
    'ORGANIZER',
    'AGENT',
    'ADMIN'
);`);
    await queryRunner.query(`CREATE TYPE auth.users_two_factor_method_enum AS ENUM (
    'SMS',
    'TOTP'
);`);
    await queryRunner.query(`CREATE TABLE auth.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying NOT NULL,
    password_hash character varying,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    role auth.users_role_enum DEFAULT 'BUYER'::auth.users_role_enum NOT NULL,
    is_email_verified boolean DEFAULT false NOT NULL,
    is_suspended boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    phone character varying,
    oauth_provider auth.users_oauth_provider_enum,
    oauth_id character varying,
    email_verified_at timestamp without time zone,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    two_factor_method auth.users_two_factor_method_enum,
    two_factor_secret character varying,
    is_active boolean DEFAULT true NOT NULL,
    suspension_reason text,
    suspended_at timestamp without time zone,
    suspended_by character varying,
    deleted_at timestamp without time zone
);`);
    await queryRunner.query(`ALTER TABLE ONLY auth.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY auth.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS auth.users CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS auth.users_two_factor_method_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS auth.users_role_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS auth.users_oauth_provider_enum`);
  }
}
