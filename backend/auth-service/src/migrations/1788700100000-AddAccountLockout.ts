import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Verrouillage temporaire de compte après trop d'échecs de connexion
 * consécutifs (CDC §10.3 : rate limiting par IP ET par compte — seul le
 * volet IP existait jusqu'ici, voir AuthService.login()).
 */
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
