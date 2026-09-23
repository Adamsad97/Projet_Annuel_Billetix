import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ajoute SUPER_ADMIN à l'enum users_role_enum — seul rôle habilité à
 * agir sur un compte ADMIN/SUPER_ADMIN (révoquer, suspendre, réactiver).
 * Jusqu'ici n'importe quel ADMIN pouvait modifier le rôle ou suspendre
 * n'importe quel autre ADMIN sans aucun contrôle (AuthService.changeRole/
 * suspendUser ignoraient totalement l'identité de l'appelant).
 *
 * Postgres autorise ADD VALUE directement (contrairement à la suppression
 * d'une valeur, cf. RemoveSmsTwoFactorMethod) — pas besoin de recréer le
 * type pour le sens up().
 */
export class AddSuperAdminRole1788700200000 implements MigrationInterface {
    name = 'AddSuperAdminRole1788700200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "auth"."users_role_enum" ADD VALUE 'SUPER_ADMIN'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Repasse tout compte SUPER_ADMIN en ADMIN avant de retirer la valeur
        // (Postgres ne supporte pas DROP VALUE, on recrée le type sans elle).
        await queryRunner.query(`UPDATE "auth"."users" SET "role" = 'ADMIN' WHERE "role" = 'SUPER_ADMIN'`);

        await queryRunner.query(`CREATE TYPE "auth"."users_role_enum_old" AS ENUM ('BUYER', 'ORGANIZER', 'AGENT', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "auth"."users" ALTER COLUMN "role" TYPE "auth"."users_role_enum_old" USING "role"::text::"auth"."users_role_enum_old"`);
        await queryRunner.query(`DROP TYPE "auth"."users_role_enum"`);
        await queryRunner.query(`ALTER TYPE "auth"."users_role_enum_old" RENAME TO "users_role_enum"`);
    }

}
