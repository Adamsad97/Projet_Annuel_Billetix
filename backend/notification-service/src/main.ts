import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { RmqPoisonMessageFilter } from './common/filters/rmq-poison-message.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new RmqPoisonMessageFilter());

  const healthPort = parseInt(process.env.HEALTH_PORT ?? `${parseInt(process.env.PORT ?? '3007') + 6000}`);

  app.connectMicroservice<MicroserviceOptions>(
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
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  await app.listen(healthPort);

  console.log('[Notification Service] En écoute sur RabbitMQ — notification_queue');
  console.log(`[Notification Service] Health check sur le port ${healthPort}`);
}
bootstrap();
