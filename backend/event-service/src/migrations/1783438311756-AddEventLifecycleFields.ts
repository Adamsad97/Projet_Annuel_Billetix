import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventLifecycleFields1783438311756 implements MigrationInterface {
    name = 'AddEventLifecycleFields1783438311756'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events"."events" ADD "terminated_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "events"."events" ADD "archived_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "events"."events" ADD "deadline_alert_sent" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events"."events" DROP COLUMN "deadline_alert_sent"`);
        await queryRunner.query(`ALTER TABLE "events"."events" DROP COLUMN "archived_at"`);
        await queryRunner.query(`ALTER TABLE "events"."events" DROP COLUMN "terminated_at"`);
    }

}
