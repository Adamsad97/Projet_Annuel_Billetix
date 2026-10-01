import { msg } from "@/lib/i18n/translate";
// Le prix de revente est plafonné à la valeur faciale (anti-spéculation) —
// vérifié aussi côté serveur (backend/ticket-service/src/resale/ticket-resale.service.ts).
export const resaleNote =
  msg("Prix plafonné à la valeur faciale — la revente à profit n'est pas autorisée sur BilleTix.");
