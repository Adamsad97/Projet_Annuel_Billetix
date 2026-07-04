import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1720051200006 implements MigrationInterface {
  name = 'InitSchema1720051200006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE admin_logs.audit_logs_action_enum AS ENUM (
    'USER_SUSPENDED',
    'USER_UNSUSPENDED',
    'USER_DELETED',
    'USER_ROLE_CHANGED',
    'EVENT_APPROVED',
    'EVENT_REJECTED',
    'EVENT_SUSPENDED',
    'EVENT_CANCELED',
    'TICKET_INVALIDATED',
    'PAYOUT_BLOCKED',
    'PAYOUT_EARLY_APPROVED',
    'REFUND_FORCED',
    'DISPUTE_RESOLVED',
    'CUSTOM'
);`);
    await queryRunner.query(`CREATE TYPE admin_logs.audit_logs_entity_type_enum AS ENUM (
    'USER',
    'EVENT',
    'ORDER',
    'TICKET',
    'PAYMENT',
    'PAYOUT',
    'DISPUTE'
);`);
    await queryRunner.query(`CREATE TABLE admin_logs.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    action admin_logs.audit_logs_action_enum DEFAULT 'CUSTOM'::admin_logs.audit_logs_action_enum NOT NULL,
    entity_type admin_logs.audit_logs_entity_type_enum NOT NULL,
    entity_id character varying,
    performed_by character varying NOT NULL,
    performed_by_email character varying,
    reason text,
    metadata jsonb,
    ip_address character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE admin_logs.platform_settings (
    key character varying(64) NOT NULL,
    value text NOT NULL,
    type character varying(16) DEFAULT 'number'::character varying NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`ALTER TABLE ONLY admin_logs.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY admin_logs.platform_settings
    ADD CONSTRAINT "PK_5d9031e30fac3ec3ec8b9602e17" PRIMARY KEY (key);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_logs.platform_settings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_logs.audit_logs CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS admin_logs.audit_logs_entity_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS admin_logs.audit_logs_action_enum`);
  }
}
