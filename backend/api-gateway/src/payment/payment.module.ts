import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { PaymentController } from "./payment.controller";
import { PurchaseFulfillmentService } from "./purchase-fulfillment.service";

@Module({
  imports: [RealtimeModule, UploadModule],
  controllers: [PaymentController],
  providers: [PurchaseFulfillmentService],
  exports: [PurchaseFulfillmentService],
})
export class PaymentModule {}
