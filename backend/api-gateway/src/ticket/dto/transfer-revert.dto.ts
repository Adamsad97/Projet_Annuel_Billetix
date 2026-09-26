import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUUID, Length } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

/** Demande d'annulation d'un transfert par l'expéditeur. */
export class RequestTransferRevertDto {
  @ApiProperty({ example: "Je me suis trompé de destinataire." })
  @Transform(trim)
  @IsString()
  @Length(10, 1000, { message: "Explique ta demande (10 à 1000 caractères)" })
  reason: string;
}

/** Annulation par un admin (demande par téléphone ou depuis la plateforme). */
export class RevertTransferDto {
  @ApiProperty({ example: "Appel de l'acheteur le 26/09 : erreur de destinataire." })
  @Transform(trim)
  @IsString()
  @Length(5, 1000, { message: "Motif de l'annulation requis (5 à 1000 caractères)" })
  reason: string;

  @ApiProperty({ enum: ["PHONE", "PLATFORM"] })
  @IsIn(["PHONE", "PLATFORM"], { message: "Origine de la demande invalide" })
  source: "PHONE" | "PLATFORM";

  @ApiProperty({ required: false, description: "Demande de l'expéditeur traitée par cette annulation" })
  @IsOptional()
  @IsUUID()
  request_id?: string;
}

/** Refus d'une demande d'annulation par un admin. */
export class RejectTransferRevertDto {
  @ApiProperty({ example: "Le billet a déjà été remis au bénéficiaire en main propre." })
  @Transform(trim)
  @IsString()
  @Length(5, 1000, { message: "Motif du refus requis (5 à 1000 caractères)" })
  reason: string;
}
