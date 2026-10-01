import { IsUUID } from "class-validator";

// Pas de montant ici : il est recalculé côté serveur depuis order-service.
export class CreatePaymentIntentDto {
  @IsUUID()
  order_id: string;
}
