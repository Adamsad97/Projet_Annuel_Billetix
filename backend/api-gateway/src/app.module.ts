import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { MicroserviceClientsModule } from "./microservice-clients.module";
import { UploadModule } from "./upload/upload.module";
import { EventsModule } from "./events/events.module";
import { EventModule } from "./event/event.module";
import { OrderModule } from "./order/order.module";
import { PaymentModule } from "./payment/payment.module";
import { TicketModule } from "./ticket/ticket.module";
import { UserModule } from "./user/user.module";
import { HealthModule } from "./health/health.module";
import { JwtGuard } from "./common/guards/jwt.guard";
import { RolesGuard } from "./common/guards/roles.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),

    MicroserviceClientsModule,

    AuthModule,
    UserModule,
    EventModule,
    OrderModule,
    TicketModule,
    PaymentModule,
    EventsModule,
    AdminModule,
    UploadModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
