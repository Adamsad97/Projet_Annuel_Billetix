import { BadRequestException, ParseUUIDPipe } from "@nestjs/common";

/**
 * Identifiant d'URL (:id, :eventId…) : refusé dès la passerelle s'il n'est
 * pas un UUID, avec un message clair, plutôt que de laisser chaque
 * microservice s'en protéger (ou échouer en erreur SQL).
 *
 *   @Param("id", UuidPipe) id: string
 */
export const UuidPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException("Identifiant invalide."),
});
