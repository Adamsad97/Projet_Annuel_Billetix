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
        queue: 'pdf_queue',
        queueOptions: { durable: true },
        noAck: false,
        prefetchCount: 5,
      },
    },
  );

  await app.listen();
  console.log('[PDF Service] En écoute sur RabbitMQ — pdf_queue');
}
bootstrap();
