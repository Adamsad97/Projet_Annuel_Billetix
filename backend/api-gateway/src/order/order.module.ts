import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { EventModule } from "../event/event.module";
import { PaymentModule } from "../payment/payment.module";
import { OrderController } from "./order.controller";

@Module({
  // EventModule : remboursement d'une commande après un report.
  imports: [PaymentModule, UploadModule, EventModule],
  controllers: [OrderController],
})
export class OrderModule {}
