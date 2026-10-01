import { MigrationInterface, QueryRunner } from "typeorm";

/** Date de naissance (le mot de passe ne doit pas la contenir) ; nullable pour les comptes existants et OAuth. */
export class AddBirthDate1795000000000 implements MigrationInterface {
    name = 'AddBirthDate1795000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth"."users" ADD "birth_date" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth"."users" DROP COLUMN "birth_date"`);
    }

}
