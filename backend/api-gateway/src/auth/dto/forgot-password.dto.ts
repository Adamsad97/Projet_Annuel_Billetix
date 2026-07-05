import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "jean.dupont@email.com" })
  @IsEmail()
  email: string;
}
