import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class UpdateNotificationPrefsDto {
  @ApiProperty({
    example: { "event-reminder": false, newsletter: true },
    description: "Map id de préférence -> activée ou non",
  })
  @IsObject()
  preferences: Record<string, boolean>;
}
