import { MigrationInterface, QueryRunner } from 'typeorm';

// Le nom d'une catégorie de billet ("Standard", "VIP"...) était saisi
// librement par l'organisateur — des variantes ("Std", "VIP2") s'étaient déjà
// glissées en base. Cette table le rend gérable depuis l'espace Admin, comme
// les catégories d'événement (cf. AddCategoriesTable) ; les variantes
// existantes sont normalisées avant d'imposer l'intégrité référentielle.
export class AddTicketTierTypes1794800000000 implements MigrationInterface {
  name = 'AddTicketTierTypes1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE events.ticket_tier_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    label character varying(60) NOT NULL,
    emoji character varying(8),
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_ticket_tier_types_id" PRIMARY KEY (id),
    CONSTRAINT "UQ_ticket_tier_types_label" UNIQUE (label)
);`);

    await queryRunner.query(`INSERT INTO events.ticket_tier_types (label, emoji, display_order) VALUES
    ('Standard', '🎫', 1),
    ('VIP', '⭐', 2);`);

    // Normalise les variantes historiques ("Std", "VIP2") avant la contrainte FK.
    await queryRunner.query(`UPDATE events.ticket_categories SET name = 'Standard' WHERE name = 'Std';`);
    await queryRunner.query(`UPDATE events.ticket_categories SET name = 'VIP' WHERE name = 'VIP2';`);

    await queryRunner.query(`ALTER TABLE events.ticket_categories
      ADD CONSTRAINT "FK_ticket_categories_name"
      FOREIGN KEY (name) REFERENCES events.ticket_tier_types(label)
      ON UPDATE CASCADE;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events.ticket_categories DROP CONSTRAINT "FK_ticket_categories_name";`);
    await queryRunner.query(`DROP TABLE events.ticket_tier_types;`);
  }
}
