import { Global, Module } from "@nestjs/common";
import { AdminRecipients } from "./admin-recipients.service";

/** Global : tout contrôleur peut prévenir les admins d'une action à traiter. */
@Global()
@Module({
  providers: [AdminRecipients],
  exports: [AdminRecipients],
})
export class AdminAlertsModule {}
