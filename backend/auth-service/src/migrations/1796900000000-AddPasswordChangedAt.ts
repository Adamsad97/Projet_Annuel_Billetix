import { MigrationInterface, QueryRunner } from "typeorm";

/** Date du dernier changement de mot de passe (renouvellement exigé après la durée réglée, CNIL). Comptes existants : point de départ à la mise en place. */
export class AddPasswordChangedAt1796900000000 implements MigrationInterface {
    name = 'AddPasswordChangedAt1796900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth"."users" ADD "password_changed_at" TIMESTAMP`);
        await queryRunner.query(`UPDATE "auth"."users" SET "password_changed_at" = now() WHERE "password_hash" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth"."users" DROP COLUMN "password_changed_at"`);
    }

}
