import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { PaymentController } from "./payment.controller";

@Module({
  imports: [EventsModule],
  controllers: [PaymentController],
})
export class PaymentModule {}
