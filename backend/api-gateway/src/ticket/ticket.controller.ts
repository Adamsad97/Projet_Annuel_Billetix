import {
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
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { firstValueFrom } from "rxjs";
import { Public } from "../common/decorators/public.decorator";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { TicketsGateway } from "../events/tickets.gateway";
import { ScanResult } from "./scan-result.enum";

@ApiTags("tickets")
@ApiBearerAuth()
@Controller("tickets")
export class TicketController {
  private readonly logger = new Logger(TicketController.name);

  constructor(
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("PDF_SERVICE") private readonly pdfClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    private readonly ticketsGateway: TicketsGateway,
  ) {}

  /**
   * Préférences niveau 2 (CDC — désactivation réelle des envois) : un échec
   * de lecture des préférences ne doit jamais empêcher la notification de
   * vente, ni surtout le remboursement lui-même — on envoie par défaut
   * (fail-open) en cas d'erreur.
   */
  private async wantsResaleUpdates(buyerId: string): Promise<boolean> {
    try {
      const prefs = await firstValueFrom(
        this.userClient.send<Record<string, boolean>>("user.get_notification_prefs", {
          user_id: buyerId,
        }),
      );
      return prefs["resale-updates"] !== false;
    } catch {
      return true;
    }
  }

  /**
   * Bug corrigé (CDC §6.2) : un ORGANIZER n'était jamais vérifié comme
   * propriétaire réel de l'événement scanné — seul son rôle JWT global
   * était contrôlé. Un AGENT, lui, est vérifié côté ticket-service
   * (affectation ControlAgent réelle, cf. ScanService.scan).
   */
  private async assertOrganizerOwnsEvent(
    userId: string,
    eventId: string,
  ): Promise<void> {
    const event = await firstValueFrom(
      this.eventClient.send<{ organizer_id: string }>("event.get", { id: eventId }),
    );
    if (event.organizer_id !== userId) {
      throw new ForbiddenException("Vous n'êtes pas l'organisateur de cet événement");
    }
  }

  // ─── Acheteur ────────────────────────────────────────────────────────────────

  /**
   * Bug corrigé : aucune vérification que la commande appartient bien à
   * l'appelant — n'importe quel compte connecté pouvait lister les billets
   * de n'importe quelle commande en devinant/récupérant son ID.
   */
  @Get("order/:orderId")
  @ApiOperation({ summary: "Billets d'une commande (le sien uniquement)" })
  async getByOrder(@CurrentUser() user: JwtPayload, @Param("orderId") orderId: string) {
    const { order } = await firstValueFrom(
      this.orderClient.send<{ order: { buyer_id: string } }>("order.get", { id: orderId }),
    );
    if (order.buyer_id !== user.sub) {
      throw new ForbiddenException("Cette commande ne vous appartient pas");
    }
    return firstValueFrom(
      this.ticketClient.send("ticket.get_by_order", { order_id: orderId }),
    );
  }

  // Bug corrigé : déclarée après @Get(":id") (ordre d'enregistrement des
  // routes Nest/Express), "/tickets/resale" était donc intercepté par la
  // route générique @Get(":id") — avec id="resale" — avant même d'atteindre
  // ce handler, renvoyant 401 "Token manquant" (getById n'est pas @Public).
  @Public()
  @Get("resale")
  @ApiOperation({ summary: "Toutes les annonces de revente actives, tous événements confondus (public)" })
  async listAllResale() {
    const listings = (await firstValueFrom(
      this.ticketClient.send("ticket.list_all_resale", {}),
    )) as Array<{ event_id: string; ticket_category_id: string }>;
    return this.enrichResaleListings(listings);
  }

  /**
   * Bug corrigé : aucune vérification du propriétaire — n'importe quel
   * compte connecté pouvait consulter le détail (et donc le QR/PDF en
   * cours de validité) de n'importe quel billet en devinant/récupérant son
   * ID. Après une revente, ça permettait notamment à l'ancien propriétaire
   * de continuer à voir le QR — désormais celui du nouvel acheteur — via un
   * lien déjà en sa possession (email, PDF, historique de navigateur).
   */
  @Get(":id")
  @ApiOperation({ summary: "Détail d'un billet (le sien uniquement)" })
  async getById(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const ticket = await firstValueFrom(
      this.ticketClient.send<{ buyer_id: string }>("ticket.get", { id }),
    );
    if (ticket.buyer_id !== user.sub) {
      throw new ForbiddenException("Ce billet ne vous appartient pas");
    }
    return ticket;
  }

  // ─── Revente ────────────────────────────────────────────────────────────────

  @Post(":id/request-resale")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Remettre un billet en vente" })
  async requestResale(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { original_order_id: string; resale_price: number },
  ) {
    const resale = await firstValueFrom(
      this.ticketClient.send<{ id: string; ticket_id: string; resale_price: number }>(
        "ticket.request_resale",
        {
          ticket_id: id,
          buyer_id: user.sub,
          original_order_id: dto.original_order_id,
          resale_price: dto.resale_price,
        },
      ),
    );

    // Confirme au vendeur que la mise en vente a bien été prise en compte —
    // fire-and-forget, ne doit jamais faire échouer la mise en vente
    // elle-même (déjà actée à ce stade).
    this.notifyResaleListed(user.sub, resale).catch((err) =>
      this.logger.error(`Erreur notification mise en vente ${resale.id}: ${err?.message}`),
    );

    return resale;
  }

  @Get(":id/resale")
  @ApiOperation({
    summary: "Annonce de revente active de ce billet, si en vente (pour la gérer/retirer)",
  })
  getActiveResale(@Param("id") id: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.get_active_resale_by_ticket", { ticket_id: id }),
    );
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Annuler un billet (bloqué à -24h du spectacle — proposer la revente)",
  })
  cancel(@Param("id") id: string) {
    return firstValueFrom(this.ticketClient.send("ticket.cancel", { id }));
  }

  @Public()
  @Get("resale/event/:eventId")
  @ApiOperation({ summary: "Billets en revente pour un événement (public)" })
  listResaleByEvent(@Param("eventId") eventId: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.list_resale_by_event", {
        event_id: eventId,
      }),
    );
  }

  @Public()
  @Get("resale/:resaleId")
  @ApiOperation({ summary: "Détail d'une offre de revente (public)" })
  async getResale(@Param("resaleId") resaleId: string) {
    const listing = await firstValueFrom(
      this.ticketClient.send("ticket.get_resale", { id: resaleId }),
    );
    const [enriched] = await this.enrichResaleListings([listing]);
    return enriched;
  }

  /**
   * Les annonces de revente ne stockent que des ID (event_id,
   * ticket_category_id) — dénormalisées côté ticket-service uniquement pour
   * ce qui lui sert en interne (transfert du billet). L'affichage marketplace
   * a besoin du nom/lieu/affiche de l'événement et du nom de catégorie, d'où
   * cet enrichissement ici plutôt que de dupliquer ces données partout.
   */
  private async enrichResaleListings<
    T extends { event_id: string; ticket_category_id: string },
  >(listings: T[]): Promise<
    (T & {
      event_name: string;
      event_venue_name: string;
      event_city: string;
      event_poster_url: string | null;
      category_name: string;
    })[]
  > {
    const eventIds = [...new Set(listings.map((listing) => listing.event_id))];
    const [events, categoriesByEvent] = await Promise.all([
      Promise.all(
        eventIds.map((id) =>
          firstValueFrom(
            this.eventClient.send<{
              title: string;
              venue_name: string;
              venue_city: string;
              poster_url: string | null;
            }>("event.get", { id }),
          ).catch(() => null),
        ),
      ),
      Promise.all(
        eventIds.map((id) =>
          firstValueFrom(
            this.eventClient.send<Array<{ id: string; name: string }>>("event.get_categories", {
              event_id: id,
            }),
          ).catch(() => [] as Array<{ id: string; name: string }>),
        ),
      ),
    ]);
    const eventById = new Map(eventIds.map((id, index) => [id, events[index]]));
    const categoriesById = new Map(eventIds.map((id, index) => [id, categoriesByEvent[index]]));

    return listings.map((listing) => {
      const event = eventById.get(listing.event_id);
      const categories = categoriesById.get(listing.event_id) ?? [];
      const category = categories.find((c) => c.id === listing.ticket_category_id);
      return {
        ...listing,
        event_name: event?.title ?? "Événement",
        event_venue_name: event?.venue_name ?? "",
        event_city: event?.venue_city ?? "",
        event_poster_url: event?.poster_url ?? null,
        category_name: category?.name ?? "Billet",
      };
    });
  }

  /**
   * Achat d'un billet en revente — crée une nouvelle commande + payment intent.
   * Le frontend complète le paiement via Stripe.js puis appelle POST /resale/:id/complete.
   */
  @Post("resale/:resaleId/purchase")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Acheter un billet en revente" })
  async purchaseResale(
    @CurrentUser() user: JwtPayload,
    @Param("resaleId") resaleId: string,
    @Body()
    dto: {
      billing_first_name: string;
      billing_last_name: string;
      billing_email: string;
      billing_address_line1: string;
      billing_address_line2?: string;
      billing_city: string;
      billing_postal_code: string;
      billing_country: string;
      payment_method: string;
    },
  ) {
    // Créer la commande pour le nouvel acheteur — order-service relit
    // lui-même l'offre de revente (prix, catégorie, événement) et le taux de
    // commission ; le prix n'est jamais accepté depuis ce endpoint.
    const { order } = await firstValueFrom(
      this.orderClient.send("order.create_resale", {
        buyer_id: user.sub,
        resale_id: resaleId,
        ...dto,
      }),
    );

    // Créer le payment intent Stripe
    const payment = await firstValueFrom(
      this.paymentClient.send("payment.create_intent", {
        order_id: order.id,
        buyer_id: user.sub,
        buyer_email: user.email,
      }),
    );

    return {
      resale_id: resaleId,
      order_id: order.id,
      client_secret: payment.client_secret,
    };
  }

  /**
   * Finalisation après paiement confirmé par Stripe.
   * Transfère le billet + rembourse l'acheteur original.
   */
  @Post("resale/:resaleId/complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Finaliser l'achat d'une revente après paiement" })
  async completeResale(
    @CurrentUser() user: JwtPayload,
    @Param("resaleId") resaleId: string,
    @Body() dto: { order_id: string },
  ) {
    // 1. Vérifier que le paiement est bien confirmé
    const payment = await firstValueFrom(
      this.paymentClient.send("payment.get_by_order", {
        order_id: dto.order_id,
      }),
    );
    if (payment.status !== "PAID") {
      return { success: false, message: "Paiement non encore confirmé" };
    }

    // Bug corrigé : le billet transféré gardait l'email/nom de l'ancien
    // titulaire (jamais mis à jour) — l'agent de contrôle aurait vu le
    // mauvais nom, et l'acheteur n'avait de toute façon aucune notification.
    // Les coordonnées saisies à l'achat (order-service) sont la source de
    // vérité pour le nouveau titulaire.
    const { order: newOrder } = await firstValueFrom(
      this.orderClient.send("order.get", { id: dto.order_id }),
    );

    // 2. Transférer le billet + marquer la revente SOLD
    const { resale, originalOrderId } = await firstValueFrom(
      this.ticketClient.send("ticket.complete_resale", {
        resale_id: resaleId,
        new_buyer_id: user.sub,
        new_order_id: dto.order_id,
        new_buyer_email: newOrder.buyer_email,
        new_holder_first_name: newOrder.buyer_first_name,
        new_holder_last_name: newOrder.buyer_last_name,
      }),
    );

    // 3. Rembourser l'acheteur original
    await firstValueFrom(
      this.paymentClient.send("payment.refund", { order_id: originalOrderId }),
    );

    // Bug corrigé : ce remboursement passait par payment.refund directement
    // (pas par POST /payments/refund/:id), donc order.mark_refunded n'était
    // jamais appelé — le paiement passait bien à REFUNDED côté
    // payment-service, mais la commande originale restait CONFIRMED/PAID
    // pour toujours côté order-service (incohérence, double comptage de
    // revenu potentiel). restore_stock: false — le billet a été transféré,
    // pas annulé : la place reste occupée par le nouvel acheteur.
    this.orderClient
      .send("order.mark_refunded", { id: originalOrderId, restore_stock: false })
      .subscribe({ error: () => undefined });

    // Notifie le vendeur original — fire-and-forget, ne doit jamais faire
    // échouer la finalisation de la revente elle-même (déjà actée à ce stade).
    this.notifyResaleSold(resale).catch((err) =>
      this.logger.error(`Erreur notification revente vendue ${resale.id}: ${err?.message}`),
    );

    // Bug corrigé : l'acheteur ne recevait jamais rien — ni email, ni PDF à
    // jour (le fichier existant embarque encore l'ancien QR, désormais
    // périmé). Régénère le PDF puis envoie le même email "billet prêt" que
    // pour un achat classique — fire-and-forget, la revente est déjà actée.
    this.notifyBuyerResalePurchase(resale.ticket_id).catch((err) =>
      this.logger.error(`Erreur notification acheteur revente ${resale.id}: ${err?.message}`),
    );

    return { success: true, resale };
  }

  private async notifyBuyerResalePurchase(ticketId: string): Promise<void> {
    const ticket = await firstValueFrom(
      this.ticketClient.send<{
        id: string;
        reference: string;
        order_id: string;
        event_name: string;
        event_start_at: string;
        event_venue_name: string;
        event_venue_address: string;
        event_city: string;
        event_poster_url?: string;
        artist_name: string;
        ticket_category_name: string;
        unit_price_ttc: number;
        seat_info?: string;
        holder_first_name: string;
        holder_last_name: string;
        buyer_email: string;
        qr_code_url: string;
      }>("ticket.get", { id: ticketId }),
    );

    this.pdfClient.emit("pdf.generate_ticket", {
      ticket_id: ticket.id,
      reference: ticket.reference,
      order_id: ticket.order_id,
      event_name: ticket.event_name,
      event_start_at: ticket.event_start_at,
      event_venue_name: ticket.event_venue_name,
      event_venue_address: ticket.event_venue_address,
      event_city: ticket.event_city,
      event_poster_url: ticket.event_poster_url,
      artist_name: ticket.artist_name,
      ticket_category_name: ticket.ticket_category_name,
      unit_price_ttc: Number(ticket.unit_price_ttc),
      seat_info: ticket.seat_info,
      holder_first_name: ticket.holder_first_name,
      holder_last_name: ticket.holder_last_name,
      buyer_email: ticket.buyer_email,
      qr_code_url: ticket.qr_code_url,
    });

    const platformConfig = await firstValueFrom(
      this.adminClient.send<{
        ticket_pdf_wait_max_attempts: number;
        ticket_pdf_wait_delay_seconds: number;
      }>("admin.get_platform_config", {}),
    ).catch(() => ({ ticket_pdf_wait_max_attempts: 5, ticket_pdf_wait_delay_seconds: 2 }));

    const pdfUrl = await this.waitForTicketPdf(
      ticket.id,
      platformConfig.ticket_pdf_wait_max_attempts,
      platformConfig.ticket_pdf_wait_delay_seconds * 1000,
    );

    this.notifClient.emit("notification.ticket_ready", {
      email: ticket.buyer_email,
      firstName: ticket.holder_first_name,
      eventName: ticket.event_name,
      eventDate: new Date(ticket.event_start_at).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      eventVenue: ticket.event_venue_name,
      tickets: [
        {
          ticketNumber: ticket.reference,
          categoryName: ticket.ticket_category_name,
          qrCodeUrl: ticket.qr_code_url,
          seatInfo: ticket.seat_info,
          pdfUrl,
        },
      ],
    });
  }

  private async waitForTicketPdf(
    ticketId: string,
    maxAttempts: number,
    delayMs: number,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const ticket = await firstValueFrom(
        this.ticketClient.send("ticket.get", { id: ticketId }),
      ).catch(() => null);

      if (ticket?.pdf_url) return ticket.pdf_url;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  private async notifyResaleSold(resale: {
    id: string;
    original_buyer_id: string;
    ticket_id: string;
    resale_price: number;
  }): Promise<void> {
    if (!(await this.wantsResaleUpdates(resale.original_buyer_id))) return;

    const [seller, ticket] = await Promise.all([
      firstValueFrom(
        this.authClient.send("auth.get_user", { id: resale.original_buyer_id }),
      ) as Promise<{ email: string; first_name: string } | null>,
      firstValueFrom(
        this.ticketClient.send("ticket.get", { id: resale.ticket_id }),
      ) as Promise<{ event_name: string }>,
    ]);
    if (!seller?.email) return;

    this.notifClient.emit("notification.resale_sold", {
      email: seller.email,
      firstName: seller.first_name,
      eventName: ticket.event_name,
      resalePrice: Number(resale.resale_price).toFixed(2),
    });
  }

  /** Confirme au vendeur que sa mise en vente a bien été prise en compte —
   * même préférence que notifyResaleSold (« Suivi de revente » couvre tout
   * le cycle de vie de l'annonce, pas seulement la vente). */
  private async notifyResaleListed(
    sellerId: string,
    resale: { ticket_id: string; resale_price: number },
  ): Promise<void> {
    if (!(await this.wantsResaleUpdates(sellerId))) return;

    const [seller, ticket] = await Promise.all([
      firstValueFrom(
        this.authClient.send("auth.get_user", { id: sellerId }),
      ) as Promise<{ email: string; first_name: string } | null>,
      firstValueFrom(
        this.ticketClient.send("ticket.get", { id: resale.ticket_id }),
      ) as Promise<{ event_name: string }>,
    ]);
    if (!seller?.email) return;

    this.notifClient.emit("notification.resale_listed", {
      email: seller.email,
      firstName: seller.first_name,
      eventName: ticket.event_name,
      resalePrice: Number(resale.resale_price).toFixed(2),
    });
  }

  @Post("resale/:resaleId/withdraw")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Retirer un billet de la revente" })
  withdrawResale(
    @CurrentUser() user: JwtPayload,
    @Param("resaleId") resaleId: string,
  ) {
    return firstValueFrom(
      this.ticketClient.send("ticket.withdraw_resale", {
        resale_id: resaleId,
        buyer_id: user.sub,
      }),
    );
  }

  // ─── Agent de contrôle : scan ────────────────────────────────────────────────

  @Post("scan")
  @HttpCode(HttpStatus.OK)
  @Roles("AGENT", "ORGANIZER")
  @ApiOperation({ summary: "Scanner un QR code (AGENT/ORGANIZER)" })
  async scan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { qr_token: string; event_id: string; device_info?: string },
  ) {
    const isOrganizer = user.role === "ORGANIZER";
    if (isOrganizer) {
      await this.assertOrganizerOwnsEvent(user.sub, dto.event_id);
    }

    const response = await firstValueFrom(
      this.ticketClient.send("ticket.scan", {
        ...dto,
        agent_id: user.sub,
        is_organizer: isOrganizer,
      }),
    );

    // Push temps réel vers le profil de l'acheteur si scan valide
    if (response.result === ScanResult.SUCCESS && response.ticket) {
      const scannedTicket = response.ticket;
      this.ticketsGateway.notifyTicketScanned(scannedTicket.buyer_id, {
        ticket_id: scannedTicket.id,
        event_name: scannedTicket.event_name,
        ticket_category_name: scannedTicket.ticket_category_name,
        holder_first_name: scannedTicket.holder_first_name,
        holder_last_name: scannedTicket.holder_last_name,
        scanned_at: scannedTicket.scanned_at,
        status: scannedTicket.status,
      });
      this.ticketsGateway.notifyDashboardUpdate(dto.event_id, "scan");

      // Bug corrigé (CDC §9) : notification.ticket_scanned avait son DTO,
      // son template et son handler prêts côté notification-service, mais
      // n'était jamais émise — seul le push WebSocket existait (perdu si
      // l'acheteur n'a pas l'app ouverte au moment du scan).
      if (scannedTicket.buyer_email) {
        this.notifClient.emit("notification.ticket_scanned", {
          email: scannedTicket.buyer_email,
          firstName: scannedTicket.holder_first_name,
          eventName: scannedTicket.event_name,
          eventDate: new Date(scannedTicket.event_start_at).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          venueName: scannedTicket.event_venue_name,
          eventCity: scannedTicket.event_city,
          artistName: scannedTicket.artist_name,
          categoryName: scannedTicket.ticket_category_name,
          holderName: `${scannedTicket.holder_first_name} ${scannedTicket.holder_last_name}`,
          scannedAt: new Date(scannedTicket.scanned_at).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }
    }

    // Alerte active (pas seulement journalisée) en cas de tentative de double
    // scan — signe possible de fraude (billet partagé/photographié).
    if (response.result === ScanResult.ALREADY_USED) {
      this.ticketsGateway.notifyAdminAlert({
        type: "duplicate_scan",
        severity: "warning",
        message: `Tentative de double scan détectée (billet ${response.ticket_id}, événement ${dto.event_id})`,
      });
    }

    return response;
  }

  @Post("sync-offline")
  @HttpCode(HttpStatus.OK)
  @Roles("AGENT", "ORGANIZER")
  @ApiOperation({
    summary: "Synchroniser les scans hors-ligne (AGENT/ORGANIZER)",
  })
  async syncOffline(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { event_id: string; entries: unknown[] },
  ) {
    const isOrganizer = user.role === "ORGANIZER";
    if (isOrganizer) {
      await this.assertOrganizerOwnsEvent(user.sub, dto.event_id);
    }

    return firstValueFrom(
      this.ticketClient.send("ticket.sync_offline", {
        agent_id: user.sub,
        ...dto,
        is_organizer: isOrganizer,
      }),
    );
  }

  @Get("event/:eventId/scan-logs")
  @Roles("ORGANIZER", "ADMIN")
  @ApiOperation({ summary: "Logs de scan d'un événement (ORGANIZER/ADMIN)" })
  getScanLogs(@Param("eventId") eventId: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.get_scan_logs", { event_id: eventId }),
    );
  }

  // ─── Organisateur : gestion des agents ──────────────────────────────────────

  /**
   * Bug corrigé (CDC §6.2) : ces 3 endpoints ne vérifiaient que le rôle JWT
   * global ORGANIZER, jamais que l'appelant est bien l'organisateur DE CET
   * événement précis — un organisateur pouvait assigner/lister/révoquer les
   * agents de contrôle de n'importe quel autre organisateur.
   */
  @Post("event/:eventId/agents")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Assigner un agent à l'événement (ORGANIZER)" })
  async assignAgent(
    @CurrentUser() user: JwtPayload,
    @Param("eventId") eventId: string,
    @Body() dto: { user_id: string; is_supervisor?: boolean },
  ) {
    await this.assertOrganizerOwnsEvent(user.sub, eventId);
    return firstValueFrom(
      this.ticketClient.send("ticket.assign_agent", {
        ...dto,
        event_id: eventId,
        assigned_by: user.sub,
      }),
    );
  }

  @Get("event/:eventId/agents")
  @Roles("ORGANIZER", "ADMIN")
  @ApiOperation({
    summary: "Liste des agents d'un événement (ORGANIZER/ADMIN)",
  })
  async getAgents(
    @CurrentUser() user: JwtPayload,
    @Param("eventId") eventId: string,
  ) {
    if (user.role === "ORGANIZER") {
      await this.assertOrganizerOwnsEvent(user.sub, eventId);
    }
    return firstValueFrom(
      this.ticketClient.send("ticket.get_agents", { event_id: eventId }),
    );
  }

  @Delete("event/:eventId/agents/:userId")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Révoquer un agent de l'événement (ORGANIZER)" })
  async removeAgent(
    @CurrentUser() user: JwtPayload,
    @Param("eventId") eventId: string,
    @Param("userId") userId: string,
  ) {
    await this.assertOrganizerOwnsEvent(user.sub, eventId);
    return firstValueFrom(
      this.ticketClient.send("ticket.remove_agent", {
        user_id: userId,
        event_id: eventId,
      }),
    );
  }

  // ─── Agent : session mobile ──────────────────────────────────────────────────

  @Post("session/start")
  @HttpCode(HttpStatus.OK)
  @Roles("AGENT", "ORGANIZER")
  @ApiOperation({ summary: "Démarrer une session de scan mobile" })
  startSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { event_id: string },
  ) {
    return firstValueFrom(
      this.ticketClient.send("ticket.start_session", {
        user_id: user.sub,
        event_id: dto.event_id,
      }),
    );
  }

  @Post("session/end")
  @HttpCode(HttpStatus.OK)
  @Roles("AGENT", "ORGANIZER")
  @ApiOperation({ summary: "Terminer la session de scan" })
  endSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { event_id: string },
  ) {
    return firstValueFrom(
      this.ticketClient.send("ticket.end_session", {
        user_id: user.sub,
        event_id: dto.event_id,
      }),
    );
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  @Post(":id/invalidate")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Invalider un billet (ADMIN)" })
  invalidate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { reason: string },
  ) {
    return firstValueFrom(
      this.ticketClient.send("ticket.invalidate", {
        id,
        admin_id: user.sub,
        reason: dto.reason,
      }),
    );
  }
}
