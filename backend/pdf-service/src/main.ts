import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { RmqPoisonMessageFilter } from './common/filters/rmq-poison-message.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  // Filet de sécurité : une erreur qui échapperait au traitement d'un message
  // (hors validation et nouvelles tentatives gérées dans le contrôleur) ne doit
  // jamais laisser le message non acquitté et bloquer la file.
  app.useGlobalFilters(new RmqPoisonMessageFilter());

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
  }, { inheritAppConfig: true });

  await app.startAllMicroservices();
  await app.listen(healthPort);

  console.log('[PDF Service] En écoute sur RabbitMQ — pdf_queue');
  console.log(`[PDF Service] Health check sur le port ${healthPort}`);
}
bootstrap();
