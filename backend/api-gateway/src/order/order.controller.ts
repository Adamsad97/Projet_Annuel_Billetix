import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { Request, Response } from "express";
import { logAccess } from "../common/access-log";
import { ClientProxy } from "@nestjs/microservices";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { firstValueFrom } from "rxjs";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { PurchaseFulfillmentService } from "../payment/purchase-fulfillment.service";
import { UploadService } from "../upload/upload.service";

@ApiTags("orders")
@ApiBearerAuth()
@Controller("orders")
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    private readonly fulfillment: PurchaseFulfillmentService,
    private readonly uploads: UploadService,
  ) {}

  /**
   * Bug corrigé (faille de contrôle d'accès) : le détail d'une commande et
   * sa facture étaient renvoyés à n'importe quel compte connecté connaissant
   * son identifiant — nom, adresse de facturation, montants d'un tiers.
   */
  private async getOwnedOrder<T extends { buyer_id: string }>(
    id: string,
    user: JwtPayload,
  ): Promise<{ order: T; items: unknown[] }> {
    const result = (await firstValueFrom(
      this.orderClient.send("order.get", { id }),
    )) as { order: T; items: unknown[] };
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (result.order.buyer_id !== user.sub && !isAdmin) {
      throw new ForbiddenException("Cette commande ne vous appartient pas");
    }
    return result;
  }

  /**
   * Étape 1 du tunnel d'achat — réserve le stock atomiquement dans Redis (TTL 10 min).
   * Retourne un reservation_token à passer dans POST /orders.
   */
  @Post("reserve")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Réserver le stock (étape 1 — TTL 10 min)" })
  reserve(
    @CurrentUser() user: JwtPayload,
    @Body()
    dto: {
      event_id: string;
      items: { ticket_category_id: string; quantity: number }[];
    },
  ) {
    // Bug corrigé : un compte ADMIN/SUPER_ADMIN reste purement administratif,
    // jamais acheteur (cf. commit 220f98e) — la règle n'était appliquée que
    // côté front (nav, page Profil). Rien n'empêchait un admin d'appeler
    // directement cette route. Bloqué dès la réservation de stock (étape 1)
    // pour couper court à tout le tunnel d'achat.
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      throw new ForbiddenException(
        "Un compte administrateur ne peut pas acheter de billets.",
      );
    }
    return firstValueFrom(
      this.orderClient.send("order.reserve_stock", {
        buyer_id: user.sub,
        event_id: dto.event_id,
        items: dto.items,
      }),
    );
  }

  /**
   * Abandon panier — libère le stock réservé.
   */
  @Delete("reserve/:token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Libérer une réservation (abandon panier)" })
  releaseReservation(@Param("token") token: string) {
    return firstValueFrom(
      this.orderClient.send("order.release_reservation", {
        reservation_token: token,
      }),
    );
  }

  /**
   * Étape 2 — crée la commande en DB (valide le reservation_token).
   * La validation du code promo et le calcul de la remise/commission sont
   * entièrement recalculés côté order-service (jamais de confiance dans une
   * valeur envoyée par le client) — la gateway ne fait que transmettre.
   *
   * Tunnel gratuit (CDC §4.1.2) : une commande dont total_amount_ttc = 0
   * (tous les billets sont à prix 0€) ne passe jamais par Stripe — aucune
   * page de paiement, aucun moyen de paiement sollicité. La confirmation,
   * la génération des billets et les notifications sont déclenchées
   * immédiatement ici, via le même service que le webhook Stripe utilise
   * pour les commandes payantes.
   */
  @Post()
  @ApiOperation({
    summary: "Passer une commande (étape 2 — après réservation stock)",
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    // Défense en profondeur : même blocage qu'à l'étape reserve() ci-dessus.
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      throw new ForbiddenException(
        "Un compte administrateur ne peut pas acheter de billets.",
      );
    }

    // Snapshot événement/organisateur — jamais fourni par le client (bug
    // corrigé : dto.event_name/dto.event_venue_name/etc. n'étaient jamais
    // renseignés en pratique, laissant ces colonnes NULL sur la commande,
    // ce qui faisait ensuite échouer systématiquement ticket-service sur
    // ses colonnes NOT NULL équivalentes). Relu ici depuis les seules
    // sources de vérité (event-service, user-service), jamais depuis dto.
    const event = await firstValueFrom(
      this.eventClient.send<{
        title: string;
        start_date: string;
        end_date: string;
        venue_name: string;
        venue_address_line1: string;
        venue_city: string;
        poster_url: string;
        organizer_id: string;
      }>("event.get", { id: dto.event_id }),
    );
    const organizerProfile = await firstValueFrom(
      this.userClient.send<{ display_name?: string } | null>(
        "user.get_organizer_profile",
        { user_id: event.organizer_id },
      ),
    ).catch(() => null);

    const result = (await firstValueFrom(
      this.orderClient.send("order.create", {
        ...dto,
        buyer_id: user.sub,
        organizer_id: event.organizer_id,
        event_name: event.title,
        event_start_at: event.start_date,
        event_end_at: event.end_date,
        event_venue_name: event.venue_name,
        event_venue_address: event.venue_address_line1,
        event_city: event.venue_city,
        event_poster_url: event.poster_url,
        artist_name: organizerProfile?.display_name ?? event.title,
      }),
    )) as {
      order: {
        id: string;
        reference: string;
        total_amount_ttc: number;
        buyer_email: string | null;
        buyer_first_name: string | null;
      };
      items: Array<{
        ticket_category_name: string;
        quantity: number;
        unit_price_ttc: number;
        total_price_ttc: number;
      }>;
    };

    if (Number(result.order.total_amount_ttc) === 0) {
      this.fulfillment.confirmAndFulfill(result.order.id, "").catch((err) =>
        this.logger.error(
          `Erreur confirmation commande gratuite ${result.order.id}: ${err?.message}`,
        ),
      );
    }
    // Commande payante : plus d'email « confirmation de commande » avant le
    // paiement (demande produit) — l'acheteur reçoit, une fois le paiement
    // reçu, la facture détaillée puis l'email d'accès à ses billets (cf.
    // PurchaseFulfillmentService).

    return result;
  }

  @Get("me")
  @ApiOperation({ summary: "Mes commandes" })
  myOrders(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.orderClient.send("order.list_by_buyer", { buyer_id: user.sub }),
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Détail d'une commande (le titulaire, ou un admin)" })
  getById(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.getOwnedOrder(id, user);
  }

  /** Facture PDF, servie au titulaire (ou à un admin) — bucket MinIO privé. */
  @Get(":id/invoice")
  @ApiOperation({ summary: "Télécharger la facture d'une commande (le titulaire, ou un admin)" })
  async getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { order } = await this.getOwnedOrder<{
      buyer_id: string;
      invoice_url: string | null;
      reference: string;
    }>(id, user);

    if (!order.invoice_url) {
      throw new BadRequestException("Facture pas encore disponible pour cette commande.");
    }
    const pdf = await this.uploads.readStoredFile(order.invoice_url);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${order.reference}.pdf"`,
      "Cache-Control": "no-store, private",
    });
    res.send(pdf);
    logAccess(this.adminClient, user, req, "INVOICE_DOWNLOADED", { type: "ORDER", id, reference: order.reference });
  }

  /**
   * Bug corrigé (CDC §9 : "renvoi de billets") : fonctionnalité totalement
   * absente — un acheteur ayant perdu/pas reçu son email de billets n'avait
   * aucun moyen de se les faire renvoyer. Réutilise notification.ticket_ready
   * (même template que l'email initial) avec les billets déjà générés.
   */
  @Post(":id/resend-tickets")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: "Renvoyer l'email des billets d'une commande" })
  async resendTickets(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    const { order } = (await firstValueFrom(
      this.orderClient.send("order.get", { id }),
    )) as {
      order: {
        buyer_id: string;
        buyer_email: string;
        buyer_first_name: string;
        event_name: string;
        event_start_at: string;
        event_venue_name: string;
        status: string;
      };
    };

    if (order.buyer_id !== user.sub) {
      throw new ForbiddenException("Cette commande ne vous appartient pas");
    }
    if (!["CONFIRMED", "TICKETS_SENT"].includes(order.status)) {
      throw new BadRequestException(
        "Aucun billet disponible pour cette commande dans son état actuel",
      );
    }

    const tickets = (await firstValueFrom(
      this.ticketClient.send("ticket.get_by_order", { order_id: id }),
    )) as Array<{
      reference: string;
      ticket_category_name: string;
      seat_info: string | null;
    }>;

    this.notifClient.emit("notification.ticket_ready", {
      email: order.buyer_email,
      firstName: order.buyer_first_name,
      eventName: order.event_name,
      eventDate: new Date(order.event_start_at).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      eventVenue: order.event_venue_name,
      tickets: tickets.map((ticket) => ({
        ticketNumber: ticket.reference,
        categoryName: ticket.ticket_category_name,
        seatInfo: ticket.seat_info,
      })),
    });

    return { success: true };
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Annuler sa propre commande (ou toute commande pour un ADMIN)" })
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { reason?: string },
  ) {
    return firstValueFrom(
      this.orderClient.send("order.cancel", {
        id,
        buyer_id: user.sub,
        is_admin: user.role === "ADMIN",
        reason: dto.reason,
      }),
    );
  }

  @Get("event/:eventId")
  @Roles("ORGANIZER", "ADMIN")
  @ApiOperation({ summary: "Commandes d'un événement (ORGANIZER/ADMIN)" })
  listByEvent(@Param("eventId") eventId: string) {
    return firstValueFrom(
      this.orderClient.send("order.list_by_event", { event_id: eventId }),
    );
  }
}
