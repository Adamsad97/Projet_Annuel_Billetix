import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

/** Code de l'application d'authentification (6 chiffres) ou code de secours. */
export class TwoFactorCodeDto {
  @ApiProperty({ example: "123456" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Le code est obligatoire." })
  @MaxLength(32)
  code: string;
}

/** Échange du code reçu au retour de Google / Facebook. */
export class OAuthCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: "Le code de connexion est obligatoire." })
  @MaxLength(512)
  code: string;
}

/** Connexion Google / Facebook d'un compte protégé par la 2FA. */
export class OAuthTwoFactorDto extends TwoFactorCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  pending_token: string;
}
