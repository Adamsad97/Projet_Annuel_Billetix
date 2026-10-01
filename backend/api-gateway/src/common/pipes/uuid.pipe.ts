import { BadRequestException, ParseUUIDPipe } from "@nestjs/common";

/** Refuse dès la passerelle un identifiant d'URL qui n'est pas un UUID, ex. @Param("id", UuidPipe). */
export const UuidPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException("Identifiant invalide."),
});
