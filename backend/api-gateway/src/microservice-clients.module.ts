import { Global, Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";

/**
 * Enregistrement centralisé et global des clients TCP/RMQ vers les microservices.
 * @Global() : évite d'avoir à ré-enregistrer ces clients dans chaque module métier
 * qui les consomme (source d'une classe de bugs de résolution de dépendances —
 * un module féature qui injecte 'XXX_SERVICE' sans l'avoir localement importé).
 */
@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: "AUTH_SERVICE",
        transport: Transport.TCP,
        options: {
          host: process.env.AUTH_SERVICE_HOST ?? "localhost",
          port: parseInt(process.env.AUTH_SERVICE_PORT ?? "3001"),
        },
      },
      {
        name: "USER_SERVICE",
        transport: Transport.TCP,
        options: {
          host: process.env.USER_SERVICE_HOST ?? "localhost",
          port: parseInt(process.env.USER_SERVICE_PORT ?? "3002"),
        },
      },
      {
        name: "EVENT_SERVICE",
        transport: Transport.TCP,
        options: {
          host: process.env.EVENT_SERVICE_HOST ?? "localhost",
          port: parseInt(process.env.EVENT_SERVICE_PORT ?? "3003"),
        },
      },
      {
        name: "ORDER_SERVICE",
        transport: Transport.TCP,
        options: {
          host: process.env.ORDER_SERVICE_HOST ?? "localhost",
          port: parseInt(process.env.ORDER_SERVICE_PORT ?? "3004"),
        },
      },
      {
        name: "TICKET_SERVICE",
        transport: Transport.TCP,
        options: {
          host: process.env.TICKET_SERVICE_HOST ?? "localhost",
          port: parseInt(process.env.TICKET_SERVICE_PORT ?? "3005"),
        },
      },
      {
        name: "PAYMENT_SERVICE",
        transport: Transport.TCP,
        options: {
          host: process.env.PAYMENT_SERVICE_HOST ?? "localhost",
          port: parseInt(process.env.PAYMENT_SERVICE_PORT ?? "3006"),
        },
      },
      {
        name: "ADMIN_SERVICE",
        transport: Transport.TCP,
        options: {
          host: process.env.ADMIN_SERVICE_HOST ?? "localhost",
          port: parseInt(process.env.ADMIN_SERVICE_PORT ?? "3009"),
        },
      },
      {
        name: "PDF_SERVICE",
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
          ],
          queue: "pdf_queue",
          queueOptions: { durable: true },
          noAck: true,
        },
      },
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
  exports: [ClientsModule],
})
export class MicroserviceClientsModule {}
