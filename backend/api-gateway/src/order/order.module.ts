import { Module } from "@nestjs/common";
import { PaymentModule } from "../payment/payment.module";
import { OrderController } from "./order.controller";

@Module({
  imports: [PaymentModule],
  controllers: [OrderController],
})
export class OrderModule {}
