import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1720051200003 implements MigrationInterface {
  name = 'InitSchema1720051200003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE orders.orders_payment_method_enum AS ENUM (
    'STRIPE',
    'PAYPAL',
    'APPLE_PAY',
    'GOOGLE_PAY',
    'ORANGE_MONEY',
    'WAVE'
);`);
    await queryRunner.query(`CREATE TYPE orders.orders_payment_status_enum AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);`);
    await queryRunner.query(`CREATE TYPE orders.orders_status_enum AS ENUM (
    'PENDING_PAYMENT',
    'CONFIRMED',
    'TICKETS_SENT',
    'CANCELLED',
    'REFUNDED'
);`);
    await queryRunner.query(`CREATE TABLE orders.order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id character varying NOT NULL,
    ticket_category_id character varying NOT NULL,
    ticket_category_name character varying,
    quantity integer NOT NULL,
    unit_price_ht numeric(10,2) NOT NULL,
    unit_price_ttc numeric(10,2) NOT NULL,
    total_price_ht numeric(10,2) NOT NULL,
    total_price_ttc numeric(10,2) NOT NULL,
    holder_first_name character varying,
    holder_last_name character varying,
    seat_info character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE orders.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reference character varying NOT NULL,
    buyer_id character varying NOT NULL,
    event_id character varying NOT NULL,
    status orders.orders_status_enum DEFAULT 'PENDING_PAYMENT'::orders.orders_status_enum NOT NULL,
    total_amount_ht numeric(10,2) NOT NULL,
    total_amount_ttc numeric(10,2) NOT NULL,
    total_commission numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total_payment_fees numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    net_organizer_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    promo_code_id character varying,
    discount_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    billing_first_name character varying NOT NULL,
    billing_last_name character varying NOT NULL,
    billing_email character varying NOT NULL,
    billing_address_line1 character varying NOT NULL,
    billing_address_line2 character varying,
    billing_city character varying NOT NULL,
    billing_postal_code character varying NOT NULL,
    billing_country character varying NOT NULL,
    payment_method orders.orders_payment_method_enum NOT NULL,
    payment_status orders.orders_payment_status_enum DEFAULT 'PENDING'::orders.orders_payment_status_enum NOT NULL,
    payment_intent_id character varying,
    paid_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancellation_reason text,
    refunded_at timestamp without time zone,
    invoice_url character varying,
    free_ticket_fees numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    organizer_id character varying,
    event_name character varying,
    event_start_at timestamp without time zone,
    event_end_at timestamp without time zone,
    event_venue_name character varying,
    event_venue_address character varying,
    event_city character varying,
    event_poster_url character varying,
    artist_name character varying,
    artist_description character varying,
    buyer_email character varying,
    buyer_first_name character varying,
    buyer_last_name character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`ALTER TABLE ONLY orders.order_items
    ADD CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY orders.orders
    ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY orders.orders
    ADD CONSTRAINT "UQ_14ea6251b9edf64025257e7475b" UNIQUE (reference);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS orders.orders CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders.order_items CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS orders.orders_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS orders.orders_payment_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS orders.orders_payment_method_enum`);
  }
}
