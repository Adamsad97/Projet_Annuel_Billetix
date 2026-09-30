import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { AdminAlertsModule } from "./admin-alerts/admin-alerts.module";
import { CreditNotesModule } from "./credit-notes/credit-notes.module";
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
import { validateEnvironment } from "./common/config/env.validation";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TimeoutInterceptor } from "./common/interceptors/timeout.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),

    MicroserviceClientsModule,
    CreditNotesModule,
    AdminAlertsModule,

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
    // Journal en premier : il mesure aussi les requêtes coupées par le délai.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule {}
