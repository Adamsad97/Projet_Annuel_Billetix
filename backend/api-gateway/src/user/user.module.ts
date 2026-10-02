import { Module } from "@nestjs/common";
import { UserDataExportService } from "./data-export.service";
import { PayoutAccountController } from "./payout-account.controller";
import { UserController } from "./user.controller";

@Module({
  controllers: [UserController, PayoutAccountController],
  providers: [UserDataExportService],
})
export class UserModule {}
