import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = parseInt(process.env.PORT ?? '3006');
  const healthPort = parseInt(process.env.HEALTH_PORT ?? `${port + 6000}`);

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.TCP,
      options: { host: '0.0.0.0', port },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  await app.listen(healthPort);

  console.log(`[Payment Service] En écoute sur le port ${port}`);
  console.log(`[Payment Service] Health check sur le port ${healthPort}`);
}
bootstrap();
