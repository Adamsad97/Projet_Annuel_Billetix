import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EventPostponementService } from "./event-postponement.service";
import { EventRefundService } from "./event-refund.service";
import { EventController } from "./event.controller";

@Module({
  // JwtModule : lecture facultative du jeton sur la route publique GET /events/:id.
  imports: [JwtModule.register({})],
  controllers: [EventController],
  providers: [EventRefundService, EventPostponementService],
  exports: [EventRefundService, EventPostponementService],
})
export class EventModule {}
