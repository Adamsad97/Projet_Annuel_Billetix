import { IsUUID } from "class-validator";

// Le montant n'est volontairement pas un champ de ce DTO — il est toujours
// recalculé côté serveur depuis order-service, jamais fourni par le client
// (cf. payment-service/src/payment/payment.service.ts::createIntent).
export class CreatePaymentIntentDto {
  @IsUUID()
  order_id: string;
}
