import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { EventsModule } from "../events/events.module";
import { PaymentController } from "./payment.controller";
import { PurchaseFulfillmentService } from "./purchase-fulfillment.service";

@Module({
  imports: [EventsModule, UploadModule],
  controllers: [PaymentController],
  providers: [PurchaseFulfillmentService],
  exports: [PurchaseFulfillmentService],
})
export class PaymentModule {}
