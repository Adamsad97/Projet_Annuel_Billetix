import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const healthPort = parseInt(process.env.HEALTH_PORT ?? `${parseInt(process.env.PORT ?? '3008') + 6000}`);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'],
      queue: 'pdf_queue',
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 5,
    },
  });

  await app.startAllMicroservices();
  await app.listen(healthPort);

  console.log('[PDF Service] En écoute sur RabbitMQ — pdf_queue');
  console.log(`[PDF Service] Health check sur le port ${healthPort}`);
}
bootstrap();
