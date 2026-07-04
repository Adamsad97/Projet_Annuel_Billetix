import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1720051200005 implements MigrationInterface {
  name = 'InitSchema1720051200005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE payments.disputes_reason_enum AS ENUM (
    'FRAUDULENT',
    'DUPLICATE',
    'PRODUCT_NOT_RECEIVED',
    'PRODUCT_UNACCEPTABLE',
    'SUBSCRIPTION_CANCELED',
    'GENERAL'
);`);
    await queryRunner.query(`CREATE TYPE payments.disputes_status_enum AS ENUM (
    'OPEN',
    'UNDER_REVIEW',
    'WON',
    'LOST',
    'CLOSED'
);`);
    await queryRunner.query(`CREATE TYPE payments.payments_provider_enum AS ENUM (
    'STRIPE',
    'PAYPAL'
);`);
    await queryRunner.query(`CREATE TYPE payments.payments_status_enum AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);`);
    await queryRunner.query(`CREATE TYPE payments.payouts_status_enum AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'BLOCKED',
    'FAILED'
);`);
    await queryRunner.query(`CREATE TABLE payments.disputes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payment_id character varying NOT NULL,
    order_id character varying NOT NULL,
    buyer_id character varying NOT NULL,
    status payments.disputes_status_enum DEFAULT 'OPEN'::payments.disputes_status_enum NOT NULL,
    reason payments.disputes_reason_enum DEFAULT 'GENERAL'::payments.disputes_reason_enum NOT NULL,
    description text,
    stripe_dispute_id character varying,
    resolved_at timestamp without time zone,
    resolved_by character varying,
    resolution_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE payments.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying DEFAULT 'eur'::character varying NOT NULL,
    provider payments.payments_provider_enum DEFAULT 'STRIPE'::payments.payments_provider_enum NOT NULL,
    provider_payment_id character varying,
    provider_client_secret character varying,
    status payments.payments_status_enum DEFAULT 'PENDING'::payments.payments_status_enum NOT NULL,
    refunded_at timestamp without time zone,
    refunded_amount numeric(10,2),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE payments.payouts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organizer_id character varying NOT NULL,
    event_id character varying NOT NULL,
    status payments.payouts_status_enum DEFAULT 'PENDING'::payments.payouts_status_enum NOT NULL,
    gross_amount numeric(10,2) NOT NULL,
    commission_amount numeric(10,2) NOT NULL,
    payment_fees_amount numeric(10,2) NOT NULL,
    net_amount numeric(10,2) NOT NULL,
    stripe_transfer_id character varying,
    scheduled_at timestamp with time zone NOT NULL,
    processed_at timestamp without time zone,
    blocked_at timestamp without time zone,
    blocked_reason text,
    blocked_by character varying,
    requested_early_at timestamp without time zone,
    early_request_approved_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`ALTER TABLE ONLY payments.payments
    ADD CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY payments.disputes
    ADD CONSTRAINT "PK_3c97580d01c1a4b0b345c42a107" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY payments.payouts
    ADD CONSTRAINT "PK_76855dc4f0a6c18c72eea302e87" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY payments.payments
    ADD CONSTRAINT "UQ_b2f7b823a21562eeca20e72b006" UNIQUE (order_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payments.payouts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments.payments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments.disputes CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS payments.payouts_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS payments.payments_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS payments.payments_provider_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS payments.disputes_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS payments.disputes_reason_enum`);
  }
}
