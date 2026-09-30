import { Global, Module } from "@nestjs/common";
import { CreditNoteIssuer } from "./credit-note-issuer.service";

/** Global : chaque point de remboursement (annulation, report, admin, revente) émet son avoir. */
@Global()
@Module({
  providers: [CreditNoteIssuer],
  exports: [CreditNoteIssuer],
})
export class CreditNotesModule {}
