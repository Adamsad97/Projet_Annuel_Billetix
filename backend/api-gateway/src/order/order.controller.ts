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
import { EventPostponementService } from "../event/event-postponement.service";
import { firstValueFrom } from "rxjs";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { PurchaseFulfillmentService } from "../payment/purchase-fulfillment.service";
import { UploadService } from "../upload/upload.service";
import { OptionalReasonDto } from "../common/dto/common.dto";
import { CreateOrderDto, ReserveStockDto } from "./dto/order.dto";
import { UuidPipe } from "../common/pipes/uuid.pipe";
import { formatEventDate } from "../common/event-date";
import { assertCanBuyTickets } from "../common/purchase-roles";

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
    private readonly postponement: EventPostponementService,
  ) {}

  /** Détail et facture d'une commande réservés à son acheteur. */
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

  /** Étape 1 du tunnel : réserve le stock dans Redis et renvoie un reservation_token. */
  @Post("reserve")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Réserver le stock (étape 1 — TTL 10 min)" })
  reserve(
    @CurrentUser() user: JwtPayload,
    @Body()
    dto: ReserveStockDto,
  ) {
    // Un compte admin n'achète jamais : bloqué dès la réservation de stock.
    assertCanBuyTickets(user.role);
    return firstValueFrom(
      this.orderClient.send("order.reserve_stock", {
        buyer_id: user.sub,
        event_id: dto.event_id,
        items: dto.items,
      }),
    );
  }

  /** Abandon panier : libère le stock réservé. */
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

  /** Étape 2 : crée la commande ; à 0 €, confirmation immédiate sans Stripe (CDC §4.1.2). */
  @Post()
  @ApiOperation({
    summary: "Passer une commande (étape 2 — après réservation stock)",
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ) {
    // Défense en profondeur : même blocage qu'à l'étape reserve() ci-dessus.
    assertCanBuyTickets(user.role);

    // Infos de l'événement et de l'organisateur relues depuis les services, jamais depuis le client.
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
    // Commande payante : facture puis accès aux billets seulement après paiement.

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
  getById(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
    return this.getOwnedOrder(id, user);
  }

  /** Facture PDF, servie au titulaire (ou à un admin) — bucket MinIO privé. */
  @Get(":id/invoice")
  @ApiOperation({ summary: "Télécharger la facture d'une commande (le titulaire, ou un admin)" })
  async getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
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

  /** Avoirs de la commande (remboursements), du plus ancien au plus récent. */
  @Get(":id/credit-notes")
  @ApiOperation({ summary: "Avoirs d'une commande remboursée (le titulaire, ou un admin)" })
  async listCreditNotes(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
    await this.getOwnedOrder(id, user);
    const notes = await firstValueFrom(
      this.orderClient.send<
        Array<{ id: string; number: string; amount_ttc: string; reason: string; pdf_url: string | null; created_at: string }>
      >("order.list_credit_notes", { order_id: id }),
    );
    // Le lien de stockage reste côté serveur : seul l'état « PDF prêt » est exposé.
    return notes.map(({ pdf_url, ...note }) => ({ ...note, amount_ttc: Number(note.amount_ttc), pdf_ready: Boolean(pdf_url) }));
  }

  /** PDF d'un avoir, servi au titulaire (ou à un admin) — bucket privé des factures. */
  @Get(":id/credit-notes/:noteId/pdf")
  @ApiOperation({ summary: "Télécharger un avoir (le titulaire, ou un admin)" })
  async getCreditNotePdf(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Param("noteId", UuidPipe) noteId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.getOwnedOrder(id, user);
    const note = await firstValueFrom(
      this.orderClient.send<{ order_id: string; number: string; pdf_url: string | null }>("order.get_credit_note", { id: noteId }),
    );
    if (note.order_id !== id) throw new ForbiddenException("Cet avoir n'appartient pas à cette commande");
    if (!note.pdf_url) throw new BadRequestException("Avoir en cours de génération, réessayez dans un instant.");
    const pdf = await this.uploads.readStoredFile(note.pdf_url);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="avoir-${note.number}.pdf"`,
      "Cache-Control": "no-store, private",
    });
    res.send(pdf);
    logAccess(this.adminClient, user, req, "INVOICE_DOWNLOADED", { type: "ORDER", id, reference: note.number });
  }

  /** CDC §9 : renvoi des billets avec le même modèle que l'email initial. */
  @Post(":id/resend-tickets")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: "Renvoyer l'email des billets d'une commande" })
  async resendTickets(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
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
      eventDate: formatEventDate(order.event_start_at),
      eventVenue: order.event_venue_name,
      tickets: tickets.map((ticket) => ({
        ticketNumber: ticket.reference,
        categoryName: ticket.ticket_category_name,
        seatInfo: ticket.seat_info,
      })),
    });

    return { success: true };
  }

  /** Remboursement possible après le report de l'événement ? (bouton de la page commande) */
  @Get(":id/postponement-refund")
  @ApiOperation({ summary: "Remboursement possible après le report de l'événement (acheteur)" })
  postponementRefundStatus(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
    return this.postponement.refundStatus(id, user.sub);
  }

  /** L'acheteur renonce à la nouvelle date : commande remboursée, billets annulés. */
  @Post(":id/postponement-refund")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: "Demander le remboursement après le report de l'événement (acheteur)" })
  requestPostponementRefund(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
    return this.postponement.refund(id, user.sub);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Annuler sa propre commande (ou toute commande pour un ADMIN)" })
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: OptionalReasonDto,
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
  listByEvent(@Param("eventId", UuidPipe) eventId: string) {
    return firstValueFrom(
      this.orderClient.send("order.list_by_event", { event_id: eventId }),
    );
  }
}
