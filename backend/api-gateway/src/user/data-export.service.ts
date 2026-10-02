import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { JwtPayload } from "../common/decorators/current-user.decorator";

/** Clés jamais exportées, même si un service venait à les renvoyer : secrets d'authentification, jetons, données chiffrées. */
const SECRET_KEY = /(^password$|password_hash|secret|token|_hash$|encrypted|_iv$|_tag$)/i;

/** Retire récursivement les clés secrètes, quelle que soit la profondeur. */
export function withoutSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => withoutSecrets(item)) as T;
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SECRET_KEY.test(key))
        .map(([key, item]) => [key, withoutSecrets(item)]),
    ) as T;
  }
  return value;
}

export interface PersonalDataExport {
  format: string;
  generated_at: string;
  account: unknown;
  buyer: {
    profile: unknown;
    notification_preferences: unknown;
    orders: unknown;
    tickets: unknown;
    ticket_transfers: unknown;
    transfer_revert_requests: unknown;
    resales_sold: unknown;
    resales_bought: unknown;
    disputes: unknown;
  };
  organizer: { profile: unknown; events: unknown; payouts: unknown } | null;
}

/** RGPD art. 15 (accès) et 20 (portabilité) : toutes les données du compte, réunies depuis chaque service, en JSON lisible par machine. */
@Injectable()
export class UserDataExportService {
  private readonly logger = new Logger(UserDataExportService.name);

  constructor(
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
  ) {}

  async build(user: JwtPayload): Promise<PersonalDataExport> {
    const id = user.sub;
    const isOrganizer = user.role === "ORGANIZER";
    try {
      const [
        account,
        profile,
        notificationPrefs,
        orders,
        tickets,
        transfers,
        revertRequests,
        resalesSold,
        resalesBought,
        disputes,
      ] = await Promise.all([
        this.call(this.authClient, "auth.get_user", { id }),
        this.optional(this.userClient, "user.get_buyer_profile", { user_id: id }),
        this.optional(this.userClient, "user.get_notification_prefs", { user_id: id }),
        this.call(this.orderClient, "order.list_by_buyer", { buyer_id: id }),
        this.call(this.ticketClient, "ticket.get_by_buyer", { buyer_id: id }),
        this.call(this.ticketClient, "ticket.transfers_by_user", { user_id: id }),
        this.call(this.ticketClient, "ticket.transfer_revert_requests_by_user", { user_id: id }),
        this.call(this.ticketClient, "ticket.resales_by_seller", { user_id: id }),
        this.call(this.ticketClient, "ticket.resales_bought_by", { user_id: id }),
        this.call(this.paymentClient, "payment.get_disputes_by_buyer", { buyer_id: id }),
      ]);

      const organizer = isOrganizer
        ? await Promise.all([
            this.optional(this.userClient, "user.get_organizer_profile", { user_id: id }),
            this.call(this.eventClient, "event.list_by_organizer", { organizer_id: id }),
            this.call(this.paymentClient, "payment.get_payouts_by_organizer", { organizer_id: id }),
          ]).then(([organizerProfile, events, payouts]) => ({ profile: organizerProfile, events, payouts }))
        : null;

      return withoutSecrets({
        format: "BilleTix — export des données personnelles (RGPD, articles 15 et 20)",
        generated_at: new Date().toISOString(),
        account,
        buyer: {
          profile,
          notification_preferences: notificationPrefs,
          orders,
          tickets,
          ticket_transfers: transfers,
          transfer_revert_requests: revertRequests,
          resales_sold: resalesSold,
          resales_bought: resalesBought,
          disputes,
        },
        organizer,
      });
    } catch (error) {
      this.logger.error(`Export RGPD impossible pour ${id} : ${(error as { message?: string })?.message ?? error}`);
      // Un export partiel laisserait croire que des données n'existent pas : tout ou rien.
      throw new ServiceUnavailableException(
        "L'export de vos données est momentanément indisponible. Veuillez réessayer dans quelques minutes.",
      );
    }
  }

  private call(client: ClientProxy, pattern: string, payload: Record<string, unknown>): Promise<unknown> {
    return firstValueFrom(client.send(pattern, payload)).catch((error: { message?: string }) => {
      // Message posé en dernier : le nom de l'appel fautif apparaît dans le journal, statusCode conservé.
      throw Object.assign(new Error(), error, { message: `${pattern} : ${error?.message ?? "erreur inconnue"}` });
    });
  }

  /** Profil absent (compte sans profil de ce type) : null plutôt qu'une erreur. */
  private optional(client: ClientProxy, pattern: string, payload: Record<string, unknown>): Promise<unknown> {
    return this.call(client, pattern, payload).catch((error: { statusCode?: number; status?: number }) => {
      if ((error?.statusCode ?? error?.status) === 404) return null;
      throw error;
    });
  }
}
