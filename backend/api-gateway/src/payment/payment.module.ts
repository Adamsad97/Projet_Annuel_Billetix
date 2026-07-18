import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { PaymentController } from "./payment.controller";
import { PurchaseFulfillmentService } from "./purchase-fulfillment.service";

@Module({
  imports: [EventsModule],
  controllers: [PaymentController],
  providers: [PurchaseFulfillmentService],
  exports: [PurchaseFulfillmentService],
})
export class PaymentModule {}
