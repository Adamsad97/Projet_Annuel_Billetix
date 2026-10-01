import { MigrationInterface, QueryRunner } from "typeorm";

/** Retire SMS de two_factor_method (jamais implémenté) en recréant le type, Postgres ne sachant pas retirer une valeur. */
export class RemoveSmsTwoFactorMethod1788700000000 implements MigrationInterface {
    name = 'RemoveSmsTwoFactorMethod1788700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Aucune ligne ne devrait valoir 'SMS' (jamais atteignable côté code),
        // mais on le force par sécurité avant de changer le type de colonne.
        await queryRunner.query(`UPDATE "auth"."users" SET "two_factor_method" = NULL, "two_factor_enabled" = false WHERE "two_factor_method" = 'SMS'`);

        await queryRunner.query(`CREATE TYPE "auth"."users_two_factor_method_enum_new" AS ENUM ('TOTP')`);
        await queryRunner.query(`ALTER TABLE "auth"."users" ALTER COLUMN "two_factor_method" TYPE "auth"."users_two_factor_method_enum_new" USING "two_factor_method"::text::"auth"."users_two_factor_method_enum_new"`);
        await queryRunner.query(`DROP TYPE "auth"."users_two_factor_method_enum"`);
        await queryRunner.query(`ALTER TYPE "auth"."users_two_factor_method_enum_new" RENAME TO "users_two_factor_method_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "auth"."users_two_factor_method_enum_old" AS ENUM ('SMS', 'TOTP')`);
        await queryRunner.query(`ALTER TABLE "auth"."users" ALTER COLUMN "two_factor_method" TYPE "auth"."users_two_factor_method_enum_old" USING "two_factor_method"::text::"auth"."users_two_factor_method_enum_old"`);
        await queryRunner.query(`DROP TYPE "auth"."users_two_factor_method_enum"`);
        await queryRunner.query(`ALTER TYPE "auth"."users_two_factor_method_enum_old" RENAME TO "users_two_factor_method_enum"`);
    }

}
