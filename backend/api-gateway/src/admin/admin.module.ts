import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { EventModule } from "../event/event.module";
import { AdminController } from "./admin.controller";
import { BankTransfersController } from "./bank-transfers.controller";

@Module({
  imports: [
    // EventRefundService : remboursements après une annulation.
    EventModule,
    ClientsModule.register([
      {
        name: "NOTIFICATION_SERVICE",
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
          ],
          queue: "notification_queue",
          queueOptions: { durable: true },
          noAck: true,
        },
      },
    ]),
  ],
  controllers: [AdminController, BankTransfersController],
})
export class AdminModule {}
