import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisModule } from "../redis/redis.module";
import { User } from "../user/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { BackupCode } from "./backup-code.entity";
import { TwoFactorService } from "./two-factor.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, BackupCode]),
    ClientsModule.registerAsync([
      {
        name: "NOTIFICATION_SERVICE",
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>(
                "RABBITMQ_URL",
                "amqp://guest:guest@localhost:5672",
              ),
            ],
            queue: "notification_queue",
            queueOptions: { durable: true },
            noAck: true,
          },
        }),
      },
      {
        // Nécessaire pour vérifier, à la désactivation de la 2FA, qu'aucun
        // IBAN organisateur n'est déjà enregistré (CDC §2.3) — voir
        // TwoFactorService.disable().
        name: "USER_SERVICE",
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>("USER_SERVICE_HOST", "localhost"),
            port: parseInt(config.get<string>("USER_SERVICE_PORT", "3002")),
          },
        }),
      },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
        signOptions: {
          expiresIn: config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m",
        },
      }),
    }),
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TwoFactorService],
})
export class AuthModule {}
