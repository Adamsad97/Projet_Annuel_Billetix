import { ClientProxy } from "@nestjs/microservices";
import { Request } from "express";
import { JwtPayload } from "./decorators/current-user.decorator";

export type AccessLogAction =
  | "TICKET_QR_VIEWED"
  | "INVOICE_DOWNLOADED"
  | "TICKET_TRANSFERRED"
  | "TICKET_TRANSFER_REVERT_REQUESTED";

/** Journalise l'accès du titulaire à son billet ou sa facture (IP, appareil), sans jamais bloquer l'accès. */
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
