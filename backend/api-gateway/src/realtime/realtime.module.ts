import { Module } from "@nestjs/common";
import { RealtimePublisher } from "./realtime.publisher";

@Module({
  providers: [RealtimePublisher],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
