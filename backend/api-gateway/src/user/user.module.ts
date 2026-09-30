import { Module } from "@nestjs/common";
import { PayoutAccountController } from "./payout-account.controller";
import { UserController } from "./user.controller";

@Module({
  controllers: [UserController, PayoutAccountController],
})
export class UserModule {}
