import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { PaymentModule } from "../payment/payment.module";
import { OrderController } from "./order.controller";

@Module({
  imports: [PaymentModule, UploadModule],
  controllers: [OrderController],
})
export class OrderModule {}
