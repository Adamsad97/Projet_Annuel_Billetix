import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";
import { AllRpcExceptionsFilter } from "./common/rpc-exception.filter";
import { rpcValidationPipe } from "./common/rpc-validation";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.useGlobalPipes(rpcValidationPipe());
  app.useGlobalFilters(new AllRpcExceptionsFilter());

  const port = parseInt(process.env.PORT ?? "3001");
  const healthPort = parseInt(process.env.HEALTH_PORT ?? `${port + 6000}`);

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.TCP,
      options: { host: "0.0.0.0", port },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  await app.listen(healthPort);

  console.log(`[Auth Service] En écoute sur le port ${port}`);
  console.log(`[Auth Service] Health check sur le port ${healthPort}`);
}
bootstrap();
