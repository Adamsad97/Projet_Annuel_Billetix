import { Global, Module } from "@nestjs/common";
import { DisputeWorkflow } from "./dispute-workflow.service";

/** Global : acheteur (réclamation), webhook Stripe (contestation) et admin (décision) partagent le même circuit. */
@Global()
@Module({
  providers: [DisputeWorkflow],
  exports: [DisputeWorkflow],
})
export class DisputesModule {}
