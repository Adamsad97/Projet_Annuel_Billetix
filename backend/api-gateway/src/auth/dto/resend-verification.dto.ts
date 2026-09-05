import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ResendVerificationDto {
  @ApiProperty({ example: "jean.dupont@email.com" })
  @IsEmail()
  email: string;
}
