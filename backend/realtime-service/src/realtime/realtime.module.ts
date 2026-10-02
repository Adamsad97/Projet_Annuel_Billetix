import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RealtimeController } from './realtime.controller';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_ACCESS_SECRET') }),
    }),
    // Lecture de l'événement pour vérifier qu'un organisateur s'abonne bien au sien.
    ClientsModule.registerAsync([
      {
        name: 'EVENT_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('EVENT_SERVICE_HOST', 'localhost'),
            port: Number(config.get<string>('EVENT_SERVICE_PORT', '3003')),
          },
        }),
      },
    ]),
  ],
  controllers: [RealtimeController],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
