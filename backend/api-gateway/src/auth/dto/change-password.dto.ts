import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  current_password: string;

  @ApiProperty({ example: "NouveauMotDePasse123!", description: "Longueur minimale paramétrable (GET /auth/registration-policy), au moins une majuscule, une minuscule, un chiffre et un caractère spécial, sans le prénom ni le nom — vérifié par auth-service" })
  @IsString()
  new_password: string;
}
