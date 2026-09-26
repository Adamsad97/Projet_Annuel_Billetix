import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches } from "class-validator";

// Lettres (accents compris), espaces, apostrophes et tirets.
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}' .-]*$/u;
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

/** Offrir un billet : compte bénéficiaire + personne qui assistera à l'événement. */
export class GiftTicketDto {
  @ApiProperty({ example: "marie@example.com", description: "Email du compte BilleTix bénéficiaire" })
  @Transform(trim)
  @IsEmail({}, { message: "Adresse email du bénéficiaire invalide" })
  recipient_email: string;

  @ApiProperty({ example: "Marie" })
  @Transform(trim)
  @IsString()
  @Length(1, 100, { message: "Prénom du titulaire requis (100 caractères maximum)" })
  @Matches(NAME_PATTERN, { message: "Le prénom du titulaire contient des caractères non autorisés" })
  holder_first_name: string;

  @ApiProperty({ example: "Martin" })
  @Transform(trim)
  @IsString()
  @Length(1, 100, { message: "Nom du titulaire requis (100 caractères maximum)" })
  @Matches(NAME_PATTERN, { message: "Le nom du titulaire contient des caractères non autorisés" })
  holder_last_name: string;
}
