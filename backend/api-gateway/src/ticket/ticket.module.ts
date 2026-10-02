import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TicketController } from "./ticket.controller";

@Module({
  imports: [RealtimeModule, UploadModule],
  controllers: [TicketController],
})
export class TicketModule {}
