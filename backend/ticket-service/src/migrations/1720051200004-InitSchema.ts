import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1720051200004 implements MigrationInterface {
  name = 'InitSchema1720051200004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE tickets.offline_sync_logs_status_enum AS ENUM (
    'SYNCED',
    'CONFLICT',
    'ERROR'
);`);
    await queryRunner.query(`CREATE TYPE tickets.scan_logs_result_enum AS ENUM (
    'SUCCESS',
    'ALREADY_USED',
    'INVALID',
    'CANCELLED'
);`);
    await queryRunner.query(`CREATE TYPE tickets.ticket_resales_status_enum AS ENUM (
    'LISTED',
    'SOLD',
    'EXPIRED',
    'WITHDRAWN'
);`);
    await queryRunner.query(`CREATE TYPE tickets.tickets_status_enum AS ENUM (
    'GENERATED',
    'SENT',
    'FOR_RESALE',
    'USED',
    'CANCELLED',
    'REFUNDED'
);`);
    await queryRunner.query(`CREATE TABLE tickets.control_agents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id character varying NOT NULL,
    event_id character varying NOT NULL,
    assigned_by character varying NOT NULL,
    is_supervisor boolean DEFAULT false NOT NULL,
    session_token character varying,
    session_started_at timestamp without time zone,
    session_expires_at timestamp without time zone,
    last_activity_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE tickets.offline_sync_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    agent_id character varying NOT NULL,
    event_id character varying NOT NULL,
    ticket_id character varying NOT NULL,
    scanned_at_offline timestamp with time zone NOT NULL,
    synced_at timestamp with time zone NOT NULL,
    status tickets.offline_sync_logs_status_enum DEFAULT 'SYNCED'::tickets.offline_sync_logs_status_enum NOT NULL,
    conflict_detail text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE tickets.scan_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id character varying NOT NULL,
    agent_id character varying NOT NULL,
    event_id character varying NOT NULL,
    scanned_at timestamp with time zone NOT NULL,
    result tickets.scan_logs_result_enum NOT NULL,
    device_info character varying,
    is_offline boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE tickets.ticket_resales (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ticket_id character varying NOT NULL,
    original_order_id character varying NOT NULL,
    original_buyer_id character varying NOT NULL,
    resale_price numeric(10,2) NOT NULL,
    status tickets.ticket_resales_status_enum DEFAULT 'LISTED'::tickets.ticket_resales_status_enum NOT NULL,
    event_id character varying NOT NULL,
    event_start_at timestamp with time zone NOT NULL,
    ticket_category_id character varying NOT NULL,
    holder_first_name character varying NOT NULL,
    holder_last_name character varying NOT NULL,
    new_buyer_id character varying,
    new_order_id character varying,
    sold_at timestamp without time zone,
    listed_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE tickets.tickets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reference character varying NOT NULL,
    order_id character varying NOT NULL,
    order_item_id character varying NOT NULL,
    event_id character varying NOT NULL,
    event_name character varying NOT NULL,
    event_start_at timestamp with time zone NOT NULL,
    event_end_at timestamp without time zone,
    event_venue_name character varying NOT NULL,
    event_venue_address character varying NOT NULL,
    event_city character varying NOT NULL,
    event_poster_url text,
    artist_name character varying NOT NULL,
    artist_description text,
    ticket_category_id character varying NOT NULL,
    ticket_category_name character varying NOT NULL,
    unit_price_ttc numeric(10,2) NOT NULL,
    seat_info character varying,
    buyer_id character varying NOT NULL,
    buyer_email character varying NOT NULL,
    holder_first_name character varying NOT NULL,
    holder_last_name character varying NOT NULL,
    qr_code_token character varying NOT NULL,
    qr_code_url text,
    pdf_url character varying,
    status tickets.tickets_status_enum DEFAULT 'GENERATED'::tickets.tickets_status_enum NOT NULL,
    scanned_at timestamp without time zone,
    scanned_by character varying,
    scan_device_info character varying,
    invalidated_at timestamp without time zone,
    invalidated_by character varying,
    invalidation_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`ALTER TABLE ONLY tickets.offline_sync_logs
    ADD CONSTRAINT "PK_12ef7586cb234e7c0e0f904bb4c" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY tickets.ticket_resales
    ADD CONSTRAINT "PK_13d580c0365903a97a7447af05b" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY tickets.tickets
    ADD CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY tickets.scan_logs
    ADD CONSTRAINT "PK_898b053110431519810c8f72d37" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY tickets.control_agents
    ADD CONSTRAINT "PK_a663ee5cfb895f89e99837e505d" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY tickets.tickets
    ADD CONSTRAINT "UQ_475c055bd3fc3ea3937e312ee2f" UNIQUE (reference);`);
    await queryRunner.query(`ALTER TABLE ONLY tickets.tickets
    ADD CONSTRAINT "UQ_4fa68fd245c509e84e65b507c74" UNIQUE (qr_code_token);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.tickets CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.ticket_resales CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.scan_logs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.offline_sync_logs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS tickets.control_agents CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS tickets.tickets_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS tickets.ticket_resales_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS tickets.scan_logs_result_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS tickets.offline_sync_logs_status_enum`);
  }
}
