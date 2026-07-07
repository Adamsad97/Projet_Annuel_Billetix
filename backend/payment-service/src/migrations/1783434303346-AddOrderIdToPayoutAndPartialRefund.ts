import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderIdToPayoutAndPartialRefund1783434303346 implements MigrationInterface {
    name = 'AddOrderIdToPayoutAndPartialRefund1783434303346'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments"."payouts" ADD "order_id" character varying`);
        await queryRunner.query(`ALTER TYPE "payments"."payments_status_enum" RENAME TO "payments_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "payments"."payments_status_enum" AS ENUM('PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED')`);
        await queryRunner.query(`ALTER TABLE "payments"."payments" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payments"."payments" ALTER COLUMN "status" TYPE "payments"."payments_status_enum" USING "status"::"text"::"payments"."payments_status_enum"`);
        await queryRunner.query(`ALTER TABLE "payments"."payments" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "payments"."payments_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "payments"."payments_status_enum_old" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`ALTER TABLE "payments"."payments" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payments"."payments" ALTER COLUMN "status" TYPE "payments"."payments_status_enum_old" USING "status"::"text"::"payments"."payments_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "payments"."payments" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "payments"."payments_status_enum"`);
        await queryRunner.query(`ALTER TYPE "payments"."payments_status_enum_old" RENAME TO "payments_status_enum"`);
        await queryRunner.query(`ALTER TABLE "payments"."payouts" DROP COLUMN "order_id"`);
    }

}
