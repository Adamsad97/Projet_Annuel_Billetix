import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBackupCodes1783505450929 implements MigrationInterface {
    name = 'AddBackupCodes1783505450929'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "auth"."backup_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "code_hash" character varying NOT NULL, "used_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_34ab957382dbc57e8fb53f1638f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_70066ea80d2f4b871beda32633" ON "auth"."backup_codes" ("user_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "auth"."IDX_70066ea80d2f4b871beda32633"`);
        await queryRunner.query(`DROP TABLE "auth"."backup_codes"`);
    }

}
