import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { AdminController } from "./admin.controller";

@Module({
  imports: [
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
  controllers: [AdminController],
})
export class AdminModule {}
