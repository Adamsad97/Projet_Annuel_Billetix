import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EventRefundService } from "./event-refund.service";
import { EventController } from "./event.controller";

@Module({
  // JwtModule : lecture facultative du jeton sur la route publique GET /events/:id.
  imports: [JwtModule.register({})],
  controllers: [EventController],
  providers: [EventRefundService],
  exports: [EventRefundService],
})
export class EventModule {}
