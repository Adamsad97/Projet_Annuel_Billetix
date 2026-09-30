import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateIbanDto {
  // Espaces et minuscules tolérés ; clé de contrôle vérifiée par le user-service.
  @ApiProperty({ example: "FR76 3000 6000 0112 3456 7890 189" })
  @IsString()
  @MaxLength(50)
  @Matches(/^\s*[A-Za-z]{2}\s*[0-9]{2}[A-Za-z0-9\s]{11,40}$/, {
    message: "Format IBAN invalide",
  })
  iban: string;

  @ApiProperty({ example: "Jean Dupont" })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  bank_owner_name: string;

  /** Mot de passe du compte (absent pour un compte Google/Facebook : connexion récente exigée). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  current_password?: string;
}

export class SetPayoutMethodDto {
  @ApiProperty({ enum: ["BANK_TRANSFER", "STRIPE"] })
  @IsIn(["BANK_TRANSFER", "STRIPE"])
  payout_method: "BANK_TRANSFER" | "STRIPE";
}
