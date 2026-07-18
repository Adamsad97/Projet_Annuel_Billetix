import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResaleReservation1783700000000 implements MigrationInterface {
  name = 'AddResaleReservation1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE tickets.ticket_resales_status_enum ADD VALUE IF NOT EXISTS 'RESERVED'`,
    );
    await queryRunner.query(`ALTER TABLE tickets.ticket_resales
      ADD COLUMN reserved_by_buyer_id character varying,
      ADD COLUMN reservation_expires_at timestamp with time zone`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tickets.ticket_resales
      DROP COLUMN IF EXISTS reserved_by_buyer_id,
      DROP COLUMN IF EXISTS reservation_expires_at`);
    // Retirer 'RESERVED' de l'enum nécessiterait de le recréer entièrement —
    // rollback volontairement non destructif, cohérent avec le reste du repo.
  }
}
