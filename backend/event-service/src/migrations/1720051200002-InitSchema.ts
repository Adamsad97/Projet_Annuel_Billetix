import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1720051200002 implements MigrationInterface {
  name = 'InitSchema1720051200002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE events.events_category_enum AS ENUM (
    'CONCERT',
    'THEATRE',
    'DANSE',
    'FESTIVAL',
    'CONFERENCE',
    'SPORT',
    'AUTRE'
);`);
    await queryRunner.query(`CREATE TYPE events.events_refund_policy_enum AS ENUM (
    'NON_REFUNDABLE',
    'REFUNDABLE'
);`);
    await queryRunner.query(`CREATE TYPE events.events_status_enum AS ENUM (
    'DRAFT',
    'PENDING_VALIDATION',
    'PUBLISHED',
    'CANCELLED',
    'TERMINATED',
    'ARCHIVED',
    'SUSPENDED'
);`);
    await queryRunner.query(`CREATE TYPE events.promo_codes_discount_type_enum AS ENUM (
    'PERCENTAGE',
    'FIXED'
);`);
    await queryRunner.query(`CREATE TYPE events.ticket_categories_visibility_enum AS ENUM (
    'PUBLIC',
    'PROMO_CODE',
    'HIDDEN'
);`);
    await queryRunner.query(`CREATE TABLE events.admin_validation_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id character varying NOT NULL,
    admin_id character varying NOT NULL,
    message text NOT NULL,
    responded_at timestamp without time zone,
    response text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE events.events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organizer_id character varying NOT NULL,
    title character varying(120) NOT NULL,
    description text NOT NULL,
    category events.events_category_enum NOT NULL,
    status events.events_status_enum DEFAULT 'DRAFT'::events.events_status_enum NOT NULL,
    is_non_profit boolean DEFAULT false NOT NULL,
    non_profit_document_url character varying,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    timezone character varying DEFAULT 'Europe/Paris'::character varying NOT NULL,
    venue_name character varying NOT NULL,
    venue_address_line1 character varying NOT NULL,
    venue_address_line2 character varying,
    venue_city character varying NOT NULL,
    venue_postal_code character varying NOT NULL,
    venue_country character varying NOT NULL,
    venue_latitude numeric(10,7),
    venue_longitude numeric(10,7),
    poster_url character varying NOT NULL,
    total_capacity integer NOT NULL,
    sales_start_date timestamp with time zone NOT NULL,
    sales_end_date timestamp with time zone NOT NULL,
    refund_policy events.events_refund_policy_enum NOT NULL,
    refund_deadline_days integer,
    access_conditions text,
    commission_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    validation_requested_at timestamp without time zone,
    validated_at timestamp without time zone,
    validated_by character varying,
    rejected_at timestamp without time zone,
    rejected_by character varying,
    rejection_reason text,
    suspended_at timestamp without time zone,
    suspended_by character varying,
    suspension_reason text,
    cancelled_at timestamp without time zone,
    cancelled_by character varying,
    cancellation_reason text,
    fill_thresholds_notified text DEFAULT '[]'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE events.promo_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id character varying NOT NULL,
    code character varying NOT NULL,
    discount_type events.promo_codes_discount_type_enum NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    max_uses integer,
    current_uses integer DEFAULT 0 NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE events.ticket_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    price_ht numeric(10,2) NOT NULL,
    quota integer NOT NULL,
    remaining_quota integer NOT NULL,
    max_per_order integer DEFAULT 10 NOT NULL,
    visibility events.ticket_categories_visibility_enum DEFAULT 'PUBLIC'::events.ticket_categories_visibility_enum NOT NULL,
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    sales_start_date timestamp without time zone,
    sales_end_date timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`ALTER TABLE ONLY events.events
    ADD CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY events.ticket_categories
    ADD CONSTRAINT "PK_6e0ee8248a3915067d3f4b64b10" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY events.promo_codes
    ADD CONSTRAINT "PK_c7b4f01710fda5afa056a2b4a35" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY events.admin_validation_requests
    ADD CONSTRAINT "PK_e884720b09e225829cac9307aae" PRIMARY KEY (id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS events.ticket_categories CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS events.promo_codes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS events.events CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS events.admin_validation_requests CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS events.ticket_categories_visibility_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS events.promo_codes_discount_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS events.events_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS events.events_refund_policy_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS events.events_category_enum`);
  }
}
