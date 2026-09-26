import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsString } from "class-validator";

export class CompleteOAuthBirthDateDto {
  @ApiProperty({ description: "pending_token reçu via /auth/oauth/exchange (requires_birth_date)" })
  @IsString()
  pending_token: string;

  @ApiProperty({ example: "1998-05-12" })
  @IsDateString(
    { strict: true },
    { message: "La date de naissance est obligatoire (format AAAA-MM-JJ)" },
  )
  birth_date: string;
}
