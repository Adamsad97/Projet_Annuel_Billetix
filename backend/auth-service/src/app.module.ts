import { join } from "path";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { BackupCode } from "./auth/backup-code.entity";
import { HealthModule } from "./health/health.module";
import { User } from "./user/user.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    ]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        url: config.get<string>("DATABASE_URL"),
        schema: "auth",
        entities: [User, BackupCode],
        synchronize: config.get("NODE_ENV") !== "production",
        migrations: [join(__dirname, "migrations", "*{.ts,.js}")],
        migrationsRun: config.get("NODE_ENV") === "production",
        logging: config.get("NODE_ENV") === "development",
      }),
    }),
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
