import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { RealtimeIoAdapter } from './realtime/realtime-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const origins = (process.env.FRONTEND_URL ?? 'http://localhost:3000').split(',').map((origin) => origin.trim());
  app.enableCors({ origin: origins, credentials: true });
  const adapter = new RealtimeIoAdapter(app, origins, process.env.REDIS_URL);
  await adapter.connectToRedis();
  app.useWebSocketAdapter(adapter);

  // Événements des autres services, relayés aux navigateurs connectés.
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'],
        queue: 'realtime_queue',
        queueOptions: { durable: true },
        noAck: true,
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  const port = Number(process.env.PORT ?? 3010);
  await app.listen(port);
  console.log(`[Realtime Service] WebSocket et /health sur le port ${port} — écoute de realtime_queue`);
}
bootstrap();
