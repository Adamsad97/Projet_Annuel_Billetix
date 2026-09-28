import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { rpcValidationPipe } from './common/rpc-validation';
import { AllRpcExceptionsFilter } from './common/rpc-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.useGlobalPipes(rpcValidationPipe());
  app.useGlobalFilters(new AllRpcExceptionsFilter());

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
