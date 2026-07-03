import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RpcExceptionFilter } from './common/filters/rpc-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));
  app.use(helmet());
  app.useGlobalFilters(new RpcExceptionFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('BilletiX API')
    .setDescription('API de la plateforme de billetterie électronique BilletiX')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification et sessions')
    .addTag('users', 'Profils utilisateurs')
    .addTag('events', 'Gestion des événements')
    .addTag('orders', 'Commandes et achats')
    .addTag('tickets', 'Billets et QR codes')
    .addTag('payments', 'Paiements et reversements')
    .addTag('admin', 'Back-office administrateur')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[API Gateway] En écoute sur le port ${port}`);
  console.log(`[API Gateway] Swagger : http://localhost:${port}/api/docs`);
}
bootstrap();
