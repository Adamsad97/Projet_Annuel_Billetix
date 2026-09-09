import { MigrationInterface, QueryRunner } from 'typeorm';

// Remplace l'enum Postgres figé events.events_category_enum par une vraie
// table gérable depuis l'espace Admin (cf. category/category.entity.ts) —
// les 7 catégories existantes sont reprises telles quelles pour ne casser
// aucun événement déjà créé.
export class AddCategoriesTable1794700000000 implements MigrationInterface {
  name = 'AddCategoriesTable1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE events.categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(30) NOT NULL,
    label character varying(60) NOT NULL,
    emoji character varying(8),
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_categories_id" PRIMARY KEY (id),
    CONSTRAINT "UQ_categories_code" UNIQUE (code)
);`);

    await queryRunner.query(`INSERT INTO events.categories (code, label, emoji, display_order) VALUES
    ('CONCERT', 'Concert', '🎵', 1),
    ('FESTIVAL', 'Festival', '🎪', 2),
    ('THEATRE', 'Théâtre', '🎭', 3),
    ('SPORT', 'Sport', '⚽', 4),
    ('CONFERENCE', 'Conférence', '💡', 5),
    ('DANSE', 'Danse', '💃', 6),
    ('AUTRE', 'Autre', '✨', 7);`);

    await queryRunner.query(`ALTER TABLE events.events ALTER COLUMN category TYPE character varying(30) USING category::text;`);
    await queryRunner.query(`ALTER TABLE events.events ADD CONSTRAINT "FK_events_category" FOREIGN KEY (category) REFERENCES events.categories(code);`);
    await queryRunner.query(`DROP TYPE events.events_category_enum;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE events.events_category_enum AS ENUM (
    'CONCERT',
    'THEATRE',
    'DANSE',
    'FESTIVAL',
    'CONFERENCE',
    'SPORT',
    'AUTRE'
);`);
    await queryRunner.query(`ALTER TABLE events.events DROP CONSTRAINT "FK_events_category";`);
    await queryRunner.query(`ALTER TABLE events.events ALTER COLUMN category TYPE events.events_category_enum USING category::events.events_category_enum;`);
    await queryRunner.query(`DROP TABLE events.categories;`);
  }
}
