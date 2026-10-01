import { MigrationInterface, QueryRunner } from "typeorm";

/** Verrouillage temporaire du compte après trop d'échecs de connexion (CDC §10.3). */
export class AddAccountLockout1788700100000 implements MigrationInterface {
    name = 'AddAccountLockout1788700100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth"."users" ADD "failed_login_attempts" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "auth"."users" ADD "locked_until" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth"."users" DROP COLUMN "locked_until"`);
        await queryRunner.query(`ALTER TABLE "auth"."users" DROP COLUMN "failed_login_attempts"`);
    }

}
