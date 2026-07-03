import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'],
        queue: 'notification_queue',
        queueOptions: { durable: true },
        noAck: false,
        prefetchCount: 10,
      },
    },
  );

  await app.listen();
  console.log('[Notification Service] En écoute sur RabbitMQ — notification_queue');
}
bootstrap();
