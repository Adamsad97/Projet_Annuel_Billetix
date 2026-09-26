import { ClientProxy } from "@nestjs/microservices";
import { Request } from "express";
import { JwtPayload } from "./decorators/current-user.decorator";

export type AccessLogAction =
  | "TICKET_QR_VIEWED"
  | "TICKET_PDF_DOWNLOADED"
  | "INVOICE_DOWNLOADED"
  | "TICKET_TRANSFERRED"
  | "TICKET_TRANSFER_REVERT_REQUESTED";

/**
 * Consigne un accès du titulaire à son billet ou à sa facture dans le
 * journal d'audit (admin-service) : qui, quand, depuis quelle IP et quel
 * appareil — pour pouvoir traiter une contestation (« je n'ai jamais
 * affiché ce billet »). Fire-and-forget : un échec de journalisation ne
 * bloque jamais l'accès.
 */
/** IP du client (derrière le reverse proxy : première entrée de X-Forwarded-For). */
export function clientIp(req: Request): string | null {
  const forwarded = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return forwarded || req.ip || null;
}

export function logAccess(
  adminClient: ClientProxy,
  user: JwtPayload,
  req: Request,
  action: AccessLogAction,
  entity: { type: "TICKET" | "ORDER"; id: string; reference?: string },
  details: Record<string, unknown> = {},
): void {
  adminClient
    .send("admin.log_action", {
      action,
      entity_type: entity.type,
      entity_id: entity.id,
      performed_by: user.sub,
      performed_by_email: user.email,
      ip_address: clientIp(req),
      metadata: {
        reference: entity.reference ?? null,
        user_agent: req.headers["user-agent"] ?? null,
        ...details,
      },
    })
    .subscribe({ error: () => undefined });
}
