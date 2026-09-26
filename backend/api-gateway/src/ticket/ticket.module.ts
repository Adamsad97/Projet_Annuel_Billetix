import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { EventsModule } from "../events/events.module";
import { TicketController } from "./ticket.controller";

@Module({
  imports: [EventsModule, UploadModule],
  controllers: [TicketController],
})
export class TicketModule {}
