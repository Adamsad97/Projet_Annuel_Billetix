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
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ConflictException,
} from "@nestjs/common";
import { assertOwnDocumentUrl } from "../upload/document-url";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ClientProxy } from "@nestjs/microservices";
import { Request } from "express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { firstValueFrom } from "rxjs";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateTicketTierTypeDto } from "./dto/create-ticket-tier-type.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateTicketTierTypeDto } from "./dto/update-ticket-tier-type.dto";
import { CancelledEventSnapshot, EventRefundService } from "./event-refund.service";
import { EventPostponementService, type PostponedEvent } from "./event-postponement.service";
import { ChangeRequestDto, ChangeRequestKind, RescheduleEventDto } from "./dto/postponement.dto";
import { Order, OrderStatus } from "./types/order-snapshot.type";
import { MessageDto, OptionalReasonDto, ReasonDto } from "../common/dto/common.dto";
import { CreatePromoCodeDto, CreateTicketCategoryDto, UpdateTicketCategoryDto, RespondToInfoRequestDto, ValidatePromoCodeDto } from "./dto/event-actions.dto";
import { UuidPipe } from "../common/pipes/uuid.pipe";
import { EventOwner } from "../common/guards/event-owner.guard";
import { findScheduleConflict, type ScheduledEvent } from "../ticket/agent-schedule";
import { formatEventDate, formatEventSchedule } from "../common/event-date";
import { AdminRecipients } from "../admin-alerts/admin-recipients.service";
import { PeriodCountsDto } from "./dto/period-counts.dto";

/** Demande d'annulation ou de report telle que renvoyée par event-service. */
interface ChangeRequestSnapshot {
  id: string;
  event_id: string;
  organizer_id: string;
  reason: string;
  kind?: "CANCELLATION" | "POSTPONEMENT";
  new_start_date?: string | null;
}

// Adresse lisible générée par event-service (cf. event/slug.ts).
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type VisibleEvent = { organizer_id: string; is_hidden?: boolean };

@ApiTags("events")
@ApiBearerAuth()
@Controller("events")
export class EventController {
  private readonly logger = new Logger(EventController.name);

  constructor(
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    @Inject("AUTH_SERVICE") private readonly authClient: ClientProxy,
    private readonly eventRefund: EventRefundService,
    private readonly postponement: EventPostponementService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly adminRecipients: AdminRecipients,
  ) {}

  // --- Routes publiques ---

  @Public()
  @Get()
  @ApiOperation({ summary: "Liste des événements publiés" })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "city", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "q", required: false, description: "Recherche mots-clés (titre, description, lieu)" })
  @ApiQuery({ name: "min_price", required: false, description: "Prix TTC minimum (€)" })
  @ApiQuery({ name: "max_price", required: false, description: "Prix TTC maximum (€)" })
  @ApiQuery({ name: "lat", required: false, description: "Latitude du point de recherche (avec lng et radius_km)" })
  @ApiQuery({ name: "lng", required: false, description: "Longitude du point de recherche (avec lat et radius_km)" })
  @ApiQuery({ name: "radius_km", required: false, description: "Rayon de recherche en km (avec lat et lng)" })
  @ApiQuery({ name: "date_from", required: false, description: "Début de période (ISO 8601)" })
  @ApiQuery({ name: "date_to", required: false, description: "Fin de période (ISO 8601)" })
  @ApiQuery({ name: "sort", required: false, enum: ["date", "recent", "price_asc", "price_desc"], description: "Tri : date de l'événement, nouveautés ou prix" })
  listPublished(
    @Query("category") category?: string,
    @Query("city") city?: string,
    @Query("page") page?: number,
    @Query("q") q?: string,
    @Query("min_price") min_price?: number,
    @Query("max_price") max_price?: number,
    @Query("lat") lat?: number,
    @Query("lng") lng?: number,
    @Query("radius_km") radius_km?: number,
    @Query("date_from") date_from?: string,
    @Query("date_to") date_to?: string,
    @Query("sort") sort?: string,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.list_published", {
        category,
        city,
        page,
        q,
        min_price: min_price !== undefined ? Number(min_price) : undefined,
        max_price: max_price !== undefined ? Number(max_price) : undefined,
        lat: lat !== undefined ? Number(lat) : undefined,
        lng: lng !== undefined ? Number(lng) : undefined,
        radius_km: radius_km !== undefined ? Number(radius_km) : undefined,
        date_from,
        date_to,
        sort: (["recent", "price_asc", "price_desc"] as const).find((value) => value === sort) ?? "date",
      }),
    );
  }

  // Déclarées avant ":id" — une route statique à un seul segment ("categories")
  // placée après une route paramétrée du même type ("/:id") serait engloutie
  // par elle (bug déjà rencontré sur /tickets/resale, cf. ticket.controller.ts).

  @Public()
  @Get("categories")
  @ApiOperation({ summary: "Catégories d'événement actives (gérées depuis l'espace Admin)" })
  listEventCategories() {
    return firstValueFrom(this.eventClient.send("event.category.list", {}));
  }

  @Public()
  @Get("categories/counts")
  @ApiOperation({ summary: "Nombre d'événements à venir par catégorie (code → nombre)" })
  countEventsByCategory() {
    return firstValueFrom(this.eventClient.send("event.count_by_category", {}));
  }

  @Public()
  @Post("counts/by-period")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Nombre d'événements par période (filtre Date : aujourd'hui, ce week-end…)" })
  countEventsByPeriod(@Body() dto: PeriodCountsDto) {
    return firstValueFrom(this.eventClient.send("event.count_in_periods", { periods: dto.periods }));
  }

  @Get("categories/all")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Toutes les catégories d'événement, y compris désactivées (ADMIN)" })
  listAllEventCategories() {
    return firstValueFrom(this.eventClient.send("event.category.list_all", {}));
  }

  @Post("categories")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Créer une catégorie d'événement (ADMIN)" })
  createEventCategory(@Body() dto: CreateCategoryDto) {
    return firstValueFrom(this.eventClient.send("event.category.create", dto));
  }

  @Patch("categories/:categoryId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Modifier une catégorie d'événement (ADMIN)" })
  updateEventCategory(@Param("categoryId", UuidPipe) categoryId: string, @Body() dto: UpdateCategoryDto) {
    return firstValueFrom(
      this.eventClient.send("event.category.update", { id: categoryId, dto }),
    );
  }

  @Delete("categories/:categoryId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Supprimer une catégorie d'événement inutilisée (ADMIN)" })
  deleteEventCategory(@Param("categoryId", UuidPipe) categoryId: string) {
    return firstValueFrom(this.eventClient.send("event.category.delete", { id: categoryId }));
  }

  @Public()
  @Get("ticket-tier-types")
  @ApiOperation({ summary: "Noms de catégorie de billet actifs (gérés depuis l'espace Admin)" })
  listTicketTierTypes() {
    return firstValueFrom(this.eventClient.send("event.ticket_tier_type.list", {}));
  }

  @Get("ticket-tier-types/all")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Tous les noms de catégorie de billet, y compris désactivés (ADMIN)" })
  listAllTicketTierTypes() {
    return firstValueFrom(this.eventClient.send("event.ticket_tier_type.list_all", {}));
  }

  @Post("ticket-tier-types")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Créer un nom de catégorie de billet (ADMIN)" })
  createTicketTierType(@Body() dto: CreateTicketTierTypeDto) {
    return firstValueFrom(this.eventClient.send("event.ticket_tier_type.create", dto));
  }

  @Patch("ticket-tier-types/:typeId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Modifier un nom de catégorie de billet (ADMIN)" })
  updateTicketTierType(@Param("typeId", UuidPipe) typeId: string, @Body() dto: UpdateTicketTierTypeDto) {
    return firstValueFrom(
      this.eventClient.send("event.ticket_tier_type.update", { id: typeId, dto }),
    );
  }

  @Delete("ticket-tier-types/:typeId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Supprimer un nom de catégorie de billet inutilisé (ADMIN)" })
  deleteTicketTierType(@Param("typeId", UuidPipe) typeId: string) {
    return firstValueFrom(this.eventClient.send("event.ticket_tier_type.delete", { id: typeId }));
  }

  /**
   * Taux appliqués à un prix de billet (réglages admin) : l'organisateur
   * voit, pendant la saisie, le prix payé par le client (TTC) et ce qu'il
   * percevra (après commission et frais de paiement). Déclarée avant
   * @Get(":id") (sinon « pricing-policy » serait pris pour un identifiant).
   */
  @Get("pricing-policy")
  @Roles("ORGANIZER", "ADMIN")
  @ApiOperation({ summary: "Taux appliqués au prix d'un billet (TVA, commission, frais)" })
  async getPricingPolicy() {
    const config = await firstValueFrom(
      this.adminClient.send<{
        tva_rate: number;
        commission_standard_percent: number;
        commission_large_event_percent: number;
        large_event_threshold: number;
        stripe_fee_percent: number;
        stripe_fee_fixed_eur: number;
        free_ticket_fee_eur: number;
      }>("admin.get_platform_config", {}),
    );
    return {
      tva_rate: config.tva_rate,
      commission_standard_percent: config.commission_standard_percent,
      commission_large_event_percent: config.commission_large_event_percent,
      large_event_threshold: config.large_event_threshold,
      stripe_fee_percent: config.stripe_fee_percent,
      stripe_fee_fixed_eur: config.stripe_fee_fixed_eur,
      free_ticket_fee_eur: config.free_ticket_fee_eur,
    };
  }

  @Public()
  @Get(":id")
  @ApiOperation({ summary: "Détail d'un événement (un événement masqué n'est visible que par son organisateur et les admins)" })
  async getById(@Param("id", UuidPipe) id: string, @Req() req: Request) {
    const event = (await firstValueFrom(this.eventClient.send("event.get", { id }))) as VisibleEvent;
    return this.assertVisible(event, req);
  }

  /**
   * Page publique par son adresse lisible (/evenements/afro-vibes-festival-2026),
   * mêmes règles de visibilité que GET :id. Deux segments : aucun conflit
   * avec les routes « :id ».
   */
  @Public()
  @Get("by-slug/:slug")
  @ApiOperation({ summary: "Détail d'un événement par son adresse lisible" })
  async getBySlug(@Param("slug") slug: string, @Req() req: Request) {
    // Une adresse mal formée désigne simplement un événement inexistant.
    if (!SLUG_PATTERN.test(slug) || slug.length > 100) throw new NotFoundException("Événement introuvable");
    const event = (await firstValueFrom(this.eventClient.send("event.get_by_slug", { slug }))) as VisibleEvent;
    return this.assertVisible(event, req);
  }

  /** Un événement masqué n'est visible que par son organisateur et les admins. */
  private assertVisible(event: VisibleEvent, req: Request): VisibleEvent {
    if (event.is_hidden) {
      const viewer = this.optionalViewer(req);
      const allowed = viewer && (viewer.role === "ADMIN" || viewer.role === "SUPER_ADMIN" || viewer.sub === event.organizer_id);
      if (!allowed) throw new NotFoundException("Événement introuvable");
    }
    return event;
  }

  /** Utilisateur connecté sur une route publique (jeton facultatif), sinon null. */
  private optionalViewer(req: Request): JwtPayload | null {
    const [type, token] = req.headers.authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) return null;
    try {
      return this.jwtService.verify<JwtPayload>(token, { secret: this.config.get<string>("JWT_ACCESS_SECRET") });
    } catch {
      return null;
    }
  }

  @Public()
  @Get(":id/categories")
  @ApiOperation({ summary: "Catégories de billets d'un événement" })
  getCategories(@Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.eventClient.send("event.get_categories", { event_id: id }),
    );
  }

  // --- Routes organisateur ---

  /**
   * Nouvelles dates : aucun agent déjà affecté ne doit se retrouver sur deux
   * événements qui se chevauchent (même règle qu'à l'affectation). Seulement
   * pour l'organisateur de l'événement — event-service refuse les autres, et
   * les agents d'un événement tiers ne sont jamais révélés.
   */
  private async assertAgentsStillAvailable(eventId: string, organizerId: string, dto: UpdateEventDto): Promise<void> {
    if (dto.start_date === undefined && dto.end_date === undefined) return;
    const current = await firstValueFrom(
      this.eventClient.send<ScheduledEvent & { organizer_id: string }>("event.get", { id: eventId }),
    ).catch(() => null);
    if (!current || current.organizer_id !== organizerId) return;

    const agents = await firstValueFrom(
      this.ticketClient.send<Array<{ user_id: string }>>("ticket.get_agents", { event_id: eventId }),
    );
    if (agents.length === 0) return;

    const target: ScheduledEvent = {
      id: eventId,
      title: current.title,
      start_date: dto.start_date ?? current.start_date,
      end_date: dto.end_date ?? current.end_date,
    };
    const conflicts: Array<{ user_id: string; event: ScheduledEvent }> = [];
    for (const agent of agents) {
      const assignedIds = (
        await firstValueFrom(this.ticketClient.send<string[]>("ticket.get_agent_events", { user_id: agent.user_id }))
      ).filter((otherId) => otherId !== eventId);
      if (assignedIds.length === 0) continue;
      const others = await firstValueFrom(this.eventClient.send<ScheduledEvent[]>("event.get_by_ids", { ids: assignedIds }));
      const conflict = findScheduleConflict(target, others);
      if (conflict) conflicts.push({ user_id: agent.user_id, event: conflict });
    }
    if (conflicts.length === 0) return;

    const accounts = await firstValueFrom(
      this.authClient.send<Array<{ id: string; first_name: string; last_name: string }>>("auth.get_users_by_ids", {
        ids: conflicts.map((c) => c.user_id),
      }),
    ).catch(() => []);
    const nameOf = (userId: string) => {
      const account = accounts.find((a) => a.id === userId);
      return account ? `${account.first_name} ${account.last_name}` : "Un agent";
    };
    const details = conflicts
      .map((c) => `${nameOf(c.user_id)} contrôle déjà « ${c.event.title} » (${formatEventDate(c.event.start_date)})`)
      .join(" ; ");
    throw new ConflictException(
      `Ces dates font chevaucher des agents avec un autre événement : ${details}. Retirez ces agents de l'événement ou choisissez d'autres dates.`,
    );
  }

  private checkNonProfitDocument(url: string | undefined, organizerId: string): void {
    if (url) assertOwnDocumentUrl(url, organizerId, this.config.get("MINIO_BUCKET_DOCUMENTS", "documents"));
  }

  @Post()
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Créer un événement (ORGANIZER)" })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEventDto) {
    this.checkNonProfitDocument(dto.non_profit_document_url, user.sub);
    return firstValueFrom(
      this.eventClient.send("event.create", { organizer_id: user.sub, dto }),
    );
  }

  @Get("me/events")
  // ADMIN : lecture seule pour le mode aperçu du back-office (il ne voit
  // que ses propres données de ce rôle, c'est-à-dire aucune).
  @Roles("ORGANIZER", "ADMIN")
  @ApiOperation({ summary: "Mes événements (ORGANIZER)" })
  myEvents(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.eventClient.send("event.list_by_organizer", {
        organizer_id: user.sub,
      }),
    );
  }

  @Get("me/dashboard")
  // ADMIN : lecture seule pour le mode aperçu du back-office (il ne voit
  // que ses propres données de ce rôle, c'est-à-dire aucune).
  @Roles("ORGANIZER", "ADMIN")
  @ApiOperation({
    summary:
      "Tableau de bord organisateur — vue globale (tous événements confondus)",
  })
  async myDashboard(@CurrentUser() user: JwtPayload) {
    const events = (await firstValueFrom(
      this.eventClient.send("event.list_by_organizer", {
        organizer_id: user.sub,
      }),
    )) as Array<{
      id: string;
      title: string;
      status: string;
      start_date: string;
      category: string;
      venue_name: string;
      venue_city: string;
      is_hidden?: boolean;
      hidden_reason?: string | null;
      suspension_reason?: string | null;
    }>;

    const balance = await firstValueFrom(
      this.paymentClient.send("payment.get_organizer_balance", {
        organizer_id: user.sub,
      }),
    ).catch(() => ({ pending_balance: 0, total_earned: 0, payouts_count: 0 }));

    const eventsSummary = await Promise.all(
      events.map(async (event) => {
        const [fillStats, revenue] = await Promise.all([
          firstValueFrom(
            this.eventClient.send("event.get_fill_stats", { event_id: event.id }),
          ).catch(() => ({ total_quota: 0, remaining: 0, sold: 0, fill_rate: 0 })),
          firstValueFrom(
            this.orderClient.send("order.get_revenue_by_event", {
              event_id: event.id,
            }),
          ).catch(() => ({
            orders_count: 0,
            revenue_ht: 0,
            revenue_ttc: 0,
            total_commission: 0,
            net_organizer_amount: 0,
          })),
        ]);

        return {
          id: event.id,
          title: event.title,
          status: event.status,
          start_date: event.start_date,
          category: event.category,
          venue_name: event.venue_name,
          venue_city: event.venue_city,
          // Décisions de l'administration, visibles par l'organisateur.
          is_hidden: event.is_hidden ?? false,
          hidden_reason: event.hidden_reason ?? null,
          suspension_reason: event.suspension_reason ?? null,
          sold: (fillStats as { sold: number }).sold,
          total_quota: (fillStats as { total_quota: number }).total_quota,
          fill_rate: (fillStats as { fill_rate: number }).fill_rate,
          revenue_ttc: (revenue as { revenue_ttc: number }).revenue_ttc,
        };
      }),
    );

    const now = new Date();
    const totals = eventsSummary.reduce(
      (acc, eventSummary) => ({
        revenue_ttc: acc.revenue_ttc + Number(eventSummary.revenue_ttc),
        tickets_sold: acc.tickets_sold + Number(eventSummary.sold),
      }),
      { revenue_ttc: 0, tickets_sold: 0 },
    );

    return {
      totals: {
        events_count: events.length,
        upcoming_events_count: events.filter(
          (event) => new Date(event.start_date) > now,
        ).length,
        revenue_ttc: totals.revenue_ttc,
        tickets_sold: totals.tickets_sold,
        pending_balance: (balance as { pending_balance: number })
          .pending_balance,
        total_earned: (balance as { total_earned: number }).total_earned,
      },
      events: eventsSummary,
    };
  }

  @Get(":id/dashboard")
  @Roles("ORGANIZER")
  @EventOwner({ param: "id" })
  @ApiOperation({
    summary: "Tableau de bord détaillé d'un événement (ORGANIZER)",
  })
  async eventDashboard(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
  ) {
    const event = (await firstValueFrom(
      this.eventClient.send("event.get", { id }),
    )) as { organizer_id: string; [key: string]: unknown };

    const [fillStats, revenue, ticketStats] = await Promise.all([
      firstValueFrom(
        this.eventClient.send("event.get_fill_stats", { event_id: id }),
      ),
      firstValueFrom(
        this.orderClient.send("order.get_revenue_by_event", { event_id: id }),
      ),
      firstValueFrom(
        this.ticketClient.send("ticket.get_stats_by_event", { event_id: id }),
      ),
    ]);

    return { event, fill_stats: fillStats, revenue, tickets: ticketStats };
  }

  @Get(":id/attendees")
  @Roles("ORGANIZER")
  @EventOwner({ param: "id" })
  @ApiOperation({ summary: "Liste des billets/participants d'un événement (ORGANIZER)" })
  eventAttendees(@Param("id", UuidPipe) id: string) {
    return firstValueFrom(this.ticketClient.send("ticket.get_by_event", { event_id: id }));
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Modifier un événement (ORGANIZER)" })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    this.checkNonProfitDocument(dto.non_profit_document_url, user.sub);
    await this.assertAgentsStillAvailable(id, user.sub, dto);
    const updatedEvent = (await firstValueFrom(
      this.eventClient.send("event.update", {
        id,
        organizer_id: user.sub,
        dto,
      }),
    )) as { id: string; title: string; status: string };

    // Bug corrigé (CDC §9 : notification "modification d'événement" jamais
    // envoyée) — une fois publié, seuls description/affiche/conditions
    // d'accès restent modifiables (cf. event-service EventService.update),
    // mais ces changements restent pertinents pour les détenteurs de billet
    // (ex : conditions d'accès à l'entrée). Fire-and-forget, ne bloque
    // jamais la réponse de mise à jour elle-même.
    // Le justificatif « but non lucratif » ne concerne pas les acheteurs.
    const publicChanges = Object.keys(dto).filter((key) => key !== "non_profit_document_url" && key !== "is_non_profit");
    if (updatedEvent.status === "PUBLISHED" && publicChanges.length > 0) {
      this.notifyBuyersOfEventUpdate(updatedEvent).catch((err) =>
        this.logger.error(
          `Erreur notification modification event ${id}: ${err?.message}`,
        ),
      );
    }

    return updatedEvent;
  }

  private async notifyBuyersOfEventUpdate(event: {
    id: string;
    title: string;
  }): Promise<void> {
    const orders = (await firstValueFrom(
      this.orderClient.send("order.list_by_event", { event_id: event.id }),
    )) as Order[];

    const activeOrders = orders.filter(
      (order) =>
        order.status === OrderStatus.CONFIRMED ||
        order.status === OrderStatus.TICKETS_SENT,
    );

    // Un envoi par acheteur unique (pas par commande) — un même acheteur
    // ayant passé plusieurs commandes ne doit recevoir l'email qu'une fois.
    const notifiedEmails = new Set<string>();
    for (const order of activeOrders) {
      if (notifiedEmails.has(order.buyer_email)) continue;
      notifiedEmails.add(order.buyer_email);
      this.notifClient.emit("notification.event_updated", {
        email: order.buyer_email,
        firstName: order.buyer_first_name,
        eventName: event.title,
      });
    }
  }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({
    summary: "Soumettre un événement à la validation (ORGANIZER)",
  })
  submit(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.eventClient.send("event.submit_for_validation", {
        id,
        organizer_id: user.sub,
      }),
    );
  }

  @Post(":id/duplicate")
  @HttpCode(HttpStatus.CREATED)
  @Roles("ORGANIZER")
  @ApiOperation({
    summary: "Dupliquer un événement en nouveau brouillon (ORGANIZER, événement récurrent simple)",
  })
  duplicate(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.eventClient.send("event.duplicate", {
        id,
        organizer_id: user.sub,
      }),
    );
  }

  @Get(":id/validation-requests")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Consulter les demandes de complément d'information de l'admin (ORGANIZER)" })
  getValidationRequests(@Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.eventClient.send("event.get_validation_requests", { event_id: id }),
    );
  }

  @Post("validation-requests/:requestId/respond")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Répondre à une demande de complément d'information (ORGANIZER, relance le délai de traitement)" })
  respondToValidationRequest(
    @CurrentUser() user: JwtPayload,
    @Param("requestId", UuidPipe) requestId: string,
    @Body() dto: RespondToInfoRequestDto,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.respond_to_info_request", {
        request_id: requestId,
        organizer_id: user.sub,
        response: dto.response,
      }),
    );
  }

  @Post(":id/categories")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Ajouter une catégorie de billet (ORGANIZER)" })
  createCategory(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: CreateTicketCategoryDto,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.create_category", {
        dto: { ...dto, event_id: id },
        organizer_id: user.sub,
      }),
    );
  }

  /** Brouillon uniquement (vérifié par event-service) : aucun billet vendu. */
  @Patch("ticket-categories/:categoryId")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Modifier une catégorie de billet d'un brouillon (ORGANIZER)" })
  updateTicketCategory(
    @CurrentUser() user: JwtPayload,
    @Param("categoryId", UuidPipe) categoryId: string,
    @Body() dto: UpdateTicketCategoryDto,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.update_category", { id: categoryId, dto, organizer_id: user.sub }),
    );
  }

  @Delete("ticket-categories/:categoryId")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Supprimer une catégorie de billet d'un brouillon (ORGANIZER)" })
  deleteTicketCategory(@CurrentUser() user: JwtPayload, @Param("categoryId", UuidPipe) categoryId: string) {
    return firstValueFrom(this.eventClient.send("event.deactivate_category", { id: categoryId, organizer_id: user.sub }));
  }

  @Post(":id/promo-codes")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Créer un code promo (ORGANIZER)" })
  createPromoCode(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: CreatePromoCodeDto,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.create_promo_code", {
        dto: { ...dto, event_id: id },
        organizer_id: user.sub,
      }),
    );
  }

  @Get(":id/promo-codes")
  @Roles("ORGANIZER", "ADMIN")
  @ApiOperation({
    summary: "Lister les codes promo d'un événement (ORGANIZER/ADMIN)",
  })
  listPromoCodes(@Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.eventClient.send("event.get_promo_codes", { event_id: id }),
    );
  }

  @Delete(":id/promo-codes/:codeId")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Désactiver un code promo (ORGANIZER)" })
  deactivatePromoCode(
    @CurrentUser() user: JwtPayload,
    @Param("codeId", UuidPipe) codeId: string,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.deactivate_promo_code", {
        id: codeId,
        organizer_id: user.sub,
      }),
    );
  }

  @Public()
  @Post("validate-promo")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Valider un code promo (public — avant commande)" })
  validatePromoCode(@Body() dto: ValidatePromoCodeDto) {
    return firstValueFrom(
      this.eventClient.send("event.validate_promo_code", {
        event_id: dto.event_id,
        code: dto.code,
      }),
    );
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER", "ADMIN")
  @ApiOperation({
    summary:
      "Annuler un événement et rembourser tous les acheteurs (ADMIN). Un organisateur passe par une demande d'annulation.",
  })
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: OptionalReasonDto,
  ) {
    if (user.role === "ORGANIZER") {
      throw new ForbiddenException(
        "L'annulation d'un événement doit être approuvée par un administrateur : faites une demande d'annulation.",
      );
    }
    const cancelledEvent = (await firstValueFrom(
      this.eventClient.send("event.cancel", { id, actor_id: user.sub, dto, is_admin: true }),
    )) as CancelledEventSnapshot;

    // Cascade de remboursements (ne bloque pas la réponse)
    this.eventRefund.refundInBackground(cancelledEvent, dto.reason);
    return cancelledEvent;
  }

  // --- Demandes d'annulation ou de report (organisateur) ---
  // L'organisateur ne peut ni annuler ni reporter seul : il demande, un admin
  // accepte ou refuse, après échange de messages.

  @Post(":id/cancellation-requests")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Demander l'annulation ou le report de son événement (ORGANIZER)" })
  async requestCancellation(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ChangeRequestDto,
  ) {
    const kind = dto.kind ?? ChangeRequestKind.CANCELLATION;
    // Report à une date connue : mêmes règles d'agents qu'un changement de dates.
    if (kind === ChangeRequestKind.POSTPONEMENT && dto.new_start_date && dto.new_end_date) {
      await this.assertAgentsStillAvailable(id, user.sub, {
        start_date: dto.new_start_date,
        end_date: dto.new_end_date,
      } as UpdateEventDto);
    }
    const request = await firstValueFrom(
      this.eventClient.send<ChangeRequestSnapshot>("event.cancellation.request", {
        event_id: id,
        organizer_id: user.sub,
        reason: dto.reason,
        kind,
        new_start_date: dto.new_start_date,
        new_end_date: dto.new_end_date,
      }),
    );
    this.notifyAdminsOfRequest(request, "NEW", request.reason);
    return request;
  }

  /**
   * Admins prévenus par email d'une demande d'annulation ou de report (ou
   * d'une réponse de l'organisateur) : la demande n'attend plus qu'on pense
   * à ouvrir la page des demandes. Sans effet sur la réponse en cas d'échec.
   */
  private notifyAdminsOfRequest(request: ChangeRequestSnapshot, action: "NEW" | "MESSAGE", text: string): void {
    (async () => {
      const [event, organizer, admins] = await Promise.all([
        firstValueFrom(
          this.eventClient.send<{ title: string; start_date: string; timezone?: string | null }>("event.get", {
            id: request.event_id,
          }),
        ),
        firstValueFrom(
          this.authClient.send<{ first_name: string; last_name: string } | null>("auth.get_user", { id: request.organizer_id }),
        ).catch(() => null),
        this.adminRecipients.list(),
      ]);
      const timezone = event.timezone ?? null;
      for (const admin of admins) {
        this.notifClient.emit("notification.admin_change_request", {
          email: admin.email,
          firstName: admin.first_name,
          kind: request.kind ?? "CANCELLATION",
          action,
          eventName: event.title,
          eventDate: formatEventDate(event.start_date, timezone),
          organizerName: organizer ? `${organizer.first_name} ${organizer.last_name}` : "L'organisateur",
          text,
          newDate: request.new_start_date ? formatEventSchedule(request.new_start_date, timezone) : undefined,
        });
      }
    })().catch((err) => this.logger.error(`Alerte admin de la demande ${request.id} : ${(err as Error)?.message}`));
  }

  /** Nouvelle date d'un événement reporté : ventes et contrôle reprennent, détenteurs prévenus. */
  @Post(":id/reschedule")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Fixer la nouvelle date d'un événement reporté (ORGANIZER)" })
  async reschedule(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: RescheduleEventDto,
  ) {
    await this.assertAgentsStillAvailable(id, user.sub, dto as UpdateEventDto);
    const event = await firstValueFrom(
      this.eventClient.send<PostponedEvent>("event.reschedule", {
        id,
        organizer_id: user.sub,
        start_date: dto.start_date,
        end_date: dto.end_date,
      }),
    );
    this.postponement.announceInBackground(event, "RESCHEDULED");
    return event;
  }

  @Get(":id/cancellation-requests")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Demandes d'annulation de son événement, avec l'échange (ORGANIZER)" })
  listCancellationRequests(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.eventClient.send("event.cancellation.list_by_event", { event_id: id, organizer_id: user.sub }),
    );
  }

  @Post("cancellation-requests/:requestId/messages")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Répondre dans l'échange d'une demande d'annulation (ORGANIZER)" })
  async postCancellationMessage(
    @CurrentUser() user: JwtPayload,
    @Param("requestId", UuidPipe) requestId: string,
    @Body() dto: MessageDto,
  ) {
    const request = await firstValueFrom(
      this.eventClient.send<ChangeRequestSnapshot>("event.cancellation.message", {
        id: requestId,
        author_id: user.sub,
        author_role: "ORGANIZER",
        message: dto?.message,
      }),
    );
    this.notifyAdminsOfRequest(request, "MESSAGE", dto.message);
    return request;
  }

  @Post("cancellation-requests/:requestId/withdraw")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Retirer sa demande d'annulation (ORGANIZER)" })
  withdrawCancellation(@CurrentUser() user: JwtPayload, @Param("requestId", UuidPipe) requestId: string) {
    return firstValueFrom(
      this.eventClient.send("event.cancellation.withdraw", { id: requestId, organizer_id: user.sub }),
    );
  }

  // --- Routes admin ---

  @Post(":id/validate")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Valider un événement (ADMIN)" })
  validate(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.eventClient.send("event.validate", { id, admin_id: user.sub }),
    );
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Rejeter un événement (ADMIN)" })
  reject(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: OptionalReasonDto,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.reject", { id, admin_id: user.sub, dto }),
    );
  }

  @Post(":id/suspend")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Suspendre un événement (ADMIN)" })
  suspend(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.suspend", { id, admin_id: user.sub, dto }),
    );
  }

  @Post(":id/request-info")
  @Roles("ADMIN")
  @ApiOperation({
    summary: "Demander des informations complémentaires (ADMIN)",
  })
  requestInfo(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: MessageDto,
  ) {
    return firstValueFrom(
      this.eventClient.send("event.request_info", {
        id,
        admin_id: user.sub,
        message: dto.message,
      }),
    );
  }
}
