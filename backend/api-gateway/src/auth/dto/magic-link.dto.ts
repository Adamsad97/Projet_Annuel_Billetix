import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length } from "class-validator";

export class RequestMagicLinkDto {
  @ApiProperty({ example: "jean.dupont@email.com" })
  @IsEmail()
  email: string;
}

export class VerifyMagicLinkDto {
  @ApiProperty({ description: "Jeton reçu dans le lien de l'email" })
  @IsString()
  @Length(20, 200)
  token: string;
}
