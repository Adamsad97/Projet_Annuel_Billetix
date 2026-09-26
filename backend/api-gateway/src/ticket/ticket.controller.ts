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
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Request, Response } from "express";
import { clientIp, logAccess } from "../common/access-log";
import { ClientProxy } from "@nestjs/microservices";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { firstValueFrom } from "rxjs";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { TicketsGateway } from "../events/tickets.gateway";
import { formatEventDate } from "../common/event-date";
import { GiftTicketDto } from "./dto/gift-ticket.dto";
import { RequestTransferRevertDto } from "./dto/transfer-revert.dto";
import { ScanResult } from "./scan-result.enum";


/** Ligne de tickets.ticket_transfers (ticket-service). */
interface TicketTransferRecord {
  id: string;
  ticket_id: string;
  ticket_reference: string;
  event_name: string;
  event_start_at: string;
  ticket_category_name: string;
  from_user_id: string;
  from_email: string;
  from_first_name: string;
  from_last_name: string;
  from_holder_first_name: string;
  from_holder_last_name: string;
  to_user_id: string;
  to_email: string;
  to_holder_first_name: string;
  to_holder_last_name: string;
  created_at: string;
  status: "ACTIVE" | "REVERTED";
  reverted_at: string | null;
}

/** Annonce de revente enrichie des infos du billet (ticket-service). */
interface ResaleRecord {
  id: string;
  ticket_id: string;
  original_order_id: string;
  original_buyer_id: string;
  new_buyer_id: string | null;
  resale_price: string | number;
  status: "LISTED" | "RESERVED" | "SOLD" | "EXPIRED" | "WITHDRAWN";
  event_start_at: string;
  listed_at: string;
  sold_at: string | null;
  ticket_reference: string | null;
  event_name: string | null;
  ticket_category_name: string | null;
}

/** Demande d'annulation d'un transfert (tickets.transfer_revert_requests). */
interface TransferRevertRequestRecord {
  id: string;
  transfer_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decision_reason: string | null;
  created_at: string;
}

/** Compte renvoyé par l'auth-service (sans mot de passe). */
interface AccountSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_email_verified: boolean;
  is_active?: boolean;
  is_suspended?: boolean;
}

/** Billet tel que renvoyé par le ticket-service (champs utiles aux emails). */
interface TransferredTicket {
  id: string;
  reference: string;
  event_name: string;
  event_start_at: string;
  event_venue_name: string;
  ticket_category_name: string;
  seat_info?: string;
  holder_first_name: string;
  buyer_email: string;
}

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
    const [tickets, resold] = await Promise.all([
      firstValueFrom(
        this.ticketClient.send<Array<{ buyer_id: string } & Record<string, unknown>>>("ticket.get_by_order", {
          order_id: orderId,
        }),
      ),
      firstValueFrom(this.ticketClient.send<ResaleRecord[]>("ticket.resales_sold_from_order", { order_id: orderId })),
    ]);
    // Billet offert depuis : reste listé dans la commande d'origine, marqué
    // comme transféré (plus accessible à l'acheteur, cf. GET /tickets/mine).
    // Billet revendu : rattaché à la commande de l'acheteur après la vente,
    // on en garde une trace (sans accès au billet) dans la commande d'origine.
    return [
      ...tickets.map((ticket) => ({ ...ticket, transferred: ticket.buyer_id !== user.sub })),
      ...resold.map((resale) => ({
        id: resale.ticket_id,
        reference: resale.ticket_reference,
        event_name: resale.event_name,
        ticket_category_name: resale.ticket_category_name,
        resold: true,
        resale_price: Number(resale.resale_price),
        sold_at: resale.sold_at,
      })),
    ];
  }

  /**
   * Billets du compte connecté : ceux dont il est titulaire (achetés,
   * reçus, rachetés en revente) et l'historique des billets qu'il a offerts
   * ou reçus. Déclarée avant @Get(":id") (sinon « mine » serait pris pour
   * un identifiant).
   */
  @Get("mine")
  @ApiOperation({ summary: "Mes billets et l'historique de mes transferts" })
  async getMine(@CurrentUser() user: JwtPayload) {
    const [tickets, transfers, requests, myResales, bought] = await Promise.all([
      firstValueFrom(this.ticketClient.send<Array<{ id: string } & Record<string, unknown>>>("ticket.get_by_buyer", { buyer_id: user.sub })),
      firstValueFrom(this.ticketClient.send<TicketTransferRecord[]>("ticket.transfers_by_user", { user_id: user.sub })),
      firstValueFrom(
        this.ticketClient.send<TransferRevertRequestRecord[]>("ticket.transfer_revert_requests_by_user", { user_id: user.sub }),
      ),
      firstValueFrom(this.ticketClient.send<ResaleRecord[]>("ticket.resales_by_seller", { user_id: user.sub })),
      firstValueFrom(this.ticketClient.send<ResaleRecord[]>("ticket.resales_bought_by", { user_id: user.sub })),
    ]);
    const boughtByTicket = new Map<string, ResaleRecord>();
    for (const resale of bought) {
      if (!boughtByTicket.has(resale.ticket_id)) boughtByTicket.set(resale.ticket_id, resale);
    }
    const receivedByTicket = new Map<string, TicketTransferRecord>();
    for (const transfer of transfers) {
      // Le plus récent d'abord : on garde la dernière réception (encore active) du billet.
      if (transfer.to_user_id === user.sub && transfer.status !== "REVERTED" && !receivedByTicket.has(transfer.ticket_id)) {
        receivedByTicket.set(transfer.ticket_id, transfer);
      }
    }
    // Demande d'annulation la plus récente de chaque transfert (liste triée, plus récente d'abord).
    const latestRequest = new Map<string, TransferRevertRequestRecord>();
    for (const request of requests) {
      if (!latestRequest.has(request.transfer_id)) latestRequest.set(request.transfer_id, request);
    }
    return {
      tickets: tickets.map((ticket) => {
        const received = receivedByTicket.get(ticket.id);
        const purchase = boughtByTicket.get(ticket.id);
        return {
          ...ticket,
          resale_purchase: purchase ? { price: Number(purchase.resale_price), at: purchase.sold_at } : null,
          received_from: received
            ? {
                first_name: received.from_first_name,
                last_name: received.from_last_name,
                email: received.from_email,
                at: received.created_at,
              }
            : null,
        };
      }),
      // Billets offerts : trace figée, sans accès au billet lui-même.
      given: transfers
        .filter((transfer) => transfer.from_user_id === user.sub)
        .map((transfer) => ({
          id: transfer.id,
          ticket_reference: transfer.ticket_reference,
          event_name: transfer.event_name,
          event_start_at: transfer.event_start_at,
          ticket_category_name: transfer.ticket_category_name,
          to_email: transfer.to_email,
          to_holder_first_name: transfer.to_holder_first_name,
          to_holder_last_name: transfer.to_holder_last_name,
          at: transfer.created_at,
          status: transfer.status,
          reverted_at: transfer.reverted_at,
          revert_request: latestRequest.has(transfer.id)
            ? {
                status: latestRequest.get(transfer.id)!.status,
                decision_reason: latestRequest.get(transfer.id)!.decision_reason,
                at: latestRequest.get(transfer.id)!.created_at,
              }
            : null,
        })),
      // Billets revendus : trace pour le vendeur (le billet n'est plus à lui).
      resold: myResales
        .filter((resale) => resale.status === "SOLD")
        .map((resale) => ({
          id: resale.id,
          ticket_reference: resale.ticket_reference,
          event_name: resale.event_name,
          event_start_at: resale.event_start_at,
          ticket_category_name: resale.ticket_category_name,
          resale_price: Number(resale.resale_price),
          listed_at: resale.listed_at,
          sold_at: resale.sold_at,
        })),
      // Billets reçus puis rendus à l'expéditeur (transfert annulé) : trace.
      withdrawn: transfers
        .filter((transfer) => transfer.to_user_id === user.sub && transfer.status === "REVERTED")
        .map((transfer) => ({
          id: transfer.id,
          ticket_reference: transfer.ticket_reference,
          event_name: transfer.event_name,
          event_start_at: transfer.event_start_at,
          ticket_category_name: transfer.ticket_category_name,
          from_first_name: transfer.from_first_name,
          from_last_name: transfer.from_last_name,
          received_at: transfer.created_at,
          reverted_at: transfer.reverted_at,
        })),
    };
  }

  /**
   * L'expéditeur demande l'annulation d'un transfert (erreur de
   * destinataire, litige…) : la demande est traitée par un admin, qui rend
   * le billet ou refuse. Il peut aussi appeler le support.
   */
  @Post("transfers/:transferId/revert-request")
  @ApiOperation({ summary: "Demander l'annulation d'un billet offert" })
  async requestTransferRevert(
    @CurrentUser() user: JwtPayload,
    @Param("transferId") transferId: string,
    @Body() dto: RequestTransferRevertDto,
    @Req() req: Request,
  ) {
    const request = await firstValueFrom(
      this.ticketClient.send<TransferRevertRequestRecord & { ticket_id: string }>("ticket.request_transfer_revert", {
        transfer_id: transferId,
        user_id: user.sub,
        reason: dto.reason,
      }),
    );
    const [transfers, sender] = await Promise.all([
      firstValueFrom(this.ticketClient.send<TicketTransferRecord[]>("ticket.transfers_by_ticket", { ticket_id: request.ticket_id })),
      firstValueFrom(this.authClient.send<AccountSummary>("auth.get_user", { id: user.sub })),
    ]);
    const transfer = transfers.find((item) => item.id === transferId);

    logAccess(
      this.adminClient,
      user,
      req,
      "TICKET_TRANSFER_REVERT_REQUESTED",
      { type: "TICKET", id: request.ticket_id, reference: transfer?.ticket_reference },
      { transfer_id: transferId, request_id: request.id, to_email: transfer?.to_email ?? null, reason: dto.reason },
    );
    if (transfer) {
      this.notifClient.emit("notification.transfer_revert_requested", {
        ticketReference: transfer.ticket_reference,
        eventName: transfer.event_name,
        eventDate: formatEventDate(transfer.event_start_at),
        senderEmail: sender.email,
        senderFirstName: sender.first_name,
        recipientEmail: transfer.to_email,
      });
    }
    return { success: true, request: { id: request.id, status: request.status, at: request.created_at } };
  }

  // Bug corrigé : déclarée après @Get(":id") (ordre d'enregistrement des
  // routes Nest/Express), "/tickets/resale" était donc intercepté par la
  // route générique @Get(":id") — avec id="resale" — avant même d'atteindre
  // ce handler, renvoyant 401 "Token manquant" (getById n'est pas @Public).
  // Revente réservée aux acheteurs connectés (demande produit) : plus de
  // consultation anonyme des annonces, ni via le site ni via l'API.
  @Roles("BUYER")
  @Get("resale")
  @ApiOperation({ summary: "Toutes les annonces de revente actives, tous événements confondus (acheteur connecté)" })
  async listAllResale() {
    const listings = (await firstValueFrom(
      this.ticketClient.send("ticket.list_all_resale", {}),
    )) as Array<{ event_id: string; ticket_category_id: string }>;
    return this.enrichResaleListings(listings);
  }


  /**
   * QR code du billet, fourni uniquement sur demande explicite du titulaire
   * (bouton « Afficher mon QR code ») et seulement tant que le billet est
   * utilisable — jamais dans les réponses de liste/détail. Durée
   * d'affichage avant masquage : platform_settings.
   */
  @Get(":id/qr")
  @ApiOperation({ summary: "QR code d'un billet valide (le sien uniquement, sur demande)" })
  async getQr(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query("refresh") refresh?: string,
  ) {
    const ticket = await firstValueFrom(
      this.ticketClient.send<{ buyer_id: string; status: string; reference: string }>(
        "ticket.get",
        { id },
      ),
    );
    if (ticket.buyer_id !== user.sub) {
      throw new ForbiddenException("Ce billet ne vous appartient pas");
    }
    if (!["GENERATED", "SENT"].includes(ticket.status)) {
      throw new ForbiddenException("Ce billet n'est pas utilisable : aucun QR code à afficher.");
    }
    const config = await firstValueFrom(
      this.adminClient.send<{ ticket_qr_display_seconds: number }>("admin.get_platform_config", {}),
    ).catch(() => ({ ticket_qr_display_seconds: 60 }));

    // QR éphémère (code aléatoire renouvelé chaque période, sans donnée du billet).
    const display = await firstValueFrom(
      this.ticketClient.send<{ qr_code_url: string; refresh_in_seconds: number }>(
        "ticket.get_display_qr",
        { id },
      ),
    );

    res.set("Cache-Control", "no-store, private");
    // Renouvellement automatique pendant l'affichage (refresh=1) : un seul
    // accès journalisé par affichage, pas un par période.
    if (refresh !== "1") {
      logAccess(this.adminClient, user, req, "TICKET_QR_VIEWED", { type: "TICKET", id, reference: ticket.reference });
    }
    return {
      qr_code_url: display.qr_code_url,
      display_seconds: config.ticket_qr_display_seconds,
      refresh_in_seconds: display.refresh_in_seconds,
    };
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
  @ApiOperation({ summary: "Détail d'un billet (le sien uniquement, sans QR code)" })
  async getById(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const ticket = await firstValueFrom(
      this.ticketClient.send<{ buyer_id: string } & Record<string, unknown>>("ticket.get", { id }),
    );
    if (ticket.buyer_id !== user.sub) {
      throw new ForbiddenException("Ce billet ne vous appartient pas");
    }
    // Billet reçu en cadeau ou acheté en revente : d'où il vient.
    const [transfers, bought] = await Promise.all([
      firstValueFrom(this.ticketClient.send<TicketTransferRecord[]>("ticket.transfers_by_ticket", { ticket_id: id })),
      firstValueFrom(this.ticketClient.send<ResaleRecord[]>("ticket.resales_bought_by", { user_id: user.sub })),
    ]);
    const received = [...transfers]
      .reverse()
      .find((transfer) => transfer.to_user_id === user.sub && transfer.status !== "REVERTED");
    const purchase = bought.find((resale) => resale.ticket_id === id);
    return {
      ...ticket,
      resale_purchase: purchase ? { price: Number(purchase.resale_price), at: purchase.sold_at } : null,
      received_from: received
        ? {
            first_name: received.from_first_name,
            last_name: received.from_last_name,
            email: received.from_email,
            at: received.created_at,
          }
        : null,
    };
  }

  // ─── Revente ────────────────────────────────────────────────────────────────

  /**
   * Offrir son billet à un autre compte BilleTix : transfert gratuit,
   * immédiat et irréversible. Exige une connexion récente (identifiants
   * ressaisis), un compte bénéficiaire actif et vérifié. Trace : historique
   * du billet (ticket-service), journal d'audit, email aux deux parties.
   */
  @Post(":id/gift")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Offrir son billet à un autre compte (irréversible)" })
  async gift(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: GiftTicketDto,
    @Req() req: Request,
  ) {
    const config = await firstValueFrom(
      this.adminClient.send<{ sensitive_action_reauth_minutes: number }>("admin.get_platform_config", {}),
    ).catch(() => ({ sensitive_action_reauth_minutes: 5 }));
    const authTime = user.auth_time ?? user.iat ?? 0;
    if (Date.now() / 1000 - authTime > config.sensitive_action_reauth_minutes * 60) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "REAUTH_REQUIRED",
        message: "Pour offrir un billet, confirme d'abord ton identité en te reconnectant.",
      });
    }

    const [sender, recipient] = await Promise.all([
      firstValueFrom(this.authClient.send<AccountSummary>("auth.get_user", { id: user.sub })),
      firstValueFrom(this.authClient.send<AccountSummary | null>("auth.find_by_email", { email: dto.recipient_email })),
    ]);
    if (recipient?.id === user.sub) {
      throw new BadRequestException("Tu ne peux pas t'offrir ton propre billet.");
    }
    const recipientEligible =
      recipient &&
      recipient.is_email_verified &&
      recipient.is_active !== false &&
      !recipient.is_suspended &&
      !["ADMIN", "SUPER_ADMIN"].includes(recipient.role);
    if (!recipientEligible) {
      throw new BadRequestException(
        "Aucun compte BilleTix actif et vérifié n'est associé à cet email. " +
          "Demande à la personne de créer son compte (et de valider son email), puis réessaie.",
      );
    }

    const { ticket, transfer } = await firstValueFrom(
      this.ticketClient.send<{ ticket: TransferredTicket; transfer: TicketTransferRecord }>("ticket.gift", {
        ticket_id: id,
        from_user_id: user.sub,
        from_first_name: sender.first_name,
        from_last_name: sender.last_name,
        to_user_id: recipient.id,
        to_email: recipient.email,
        to_holder_first_name: dto.holder_first_name,
        to_holder_last_name: dto.holder_last_name,
        ip_address: clientIp(req),
        user_agent: req.headers["user-agent"] ?? null,
      }),
    );

    logAccess(
      this.adminClient,
      user,
      req,
      "TICKET_TRANSFERRED",
      { type: "TICKET", id, reference: ticket.reference },
      {
        transfer_id: transfer.id,
        from_email: transfer.from_email,
        to_user_id: transfer.to_user_id,
        to_email: transfer.to_email,
        holder_before: `${transfer.from_holder_first_name} ${transfer.from_holder_last_name}`,
        holder_after: `${transfer.to_holder_first_name} ${transfer.to_holder_last_name}`,
        event_name: transfer.event_name,
      },
    );

    this.notifClient.emit("notification.ticket_transferred", {
      ticketReference: ticket.reference,
      eventName: ticket.event_name,
      eventDate: new Date(ticket.event_start_at).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      eventVenue: ticket.event_venue_name,
      categoryName: ticket.ticket_category_name,
      senderEmail: sender.email,
      senderFirstName: sender.first_name,
      senderLastName: sender.last_name,
      recipientEmail: recipient.email,
      recipientFirstName: recipient.first_name,
      holderFirstName: transfer.to_holder_first_name,
      holderLastName: transfer.to_holder_last_name,
      transferredAt: new Date(transfer.created_at).toLocaleString("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }),
    });

    return {
      success: true,
      transfer: {
        id: transfer.id,
        ticket_reference: transfer.ticket_reference,
        to_email: transfer.to_email,
        to_holder_first_name: transfer.to_holder_first_name,
        to_holder_last_name: transfer.to_holder_last_name,
        at: transfer.created_at,
      },
    };
  }

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

  @Roles("BUYER")
  @Get("resale/event/:eventId")
  @ApiOperation({ summary: "Billets en revente pour un événement (acheteur connecté)" })
  listResaleByEvent(@Param("eventId") eventId: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.list_resale_by_event", {
        event_id: eventId,
      }),
    );
  }

  @Roles("BUYER")
  @Get("resale/:resaleId")
  @ApiOperation({ summary: "Détail d'une offre de revente (acheteur connecté)" })
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

    // Bug corrigé : l'acheteur ne recevait jamais rien. Même email "billet
    // prêt" que pour un achat classique (la facture part avec le
    // post-paiement) — fire-and-forget, la revente est déjà actée.
    this.notifyBuyerResalePurchase(resale.ticket_id).catch((err) =>
      this.logger.error(`Erreur notification acheteur revente ${resale.id}: ${err?.message}`),
    );

    return { success: true, resale };
  }

  private async notifyBuyerResalePurchase(ticketId: string): Promise<void> {
    const ticket = await firstValueFrom(
      this.ticketClient.send<TransferredTicket>("ticket.get", { id: ticketId }),
    );

    // Le billet ne se consulte que dans l'application : l'email ne contient
    // ni billet ni QR code.
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
          seatInfo: ticket.seat_info,
        },
      ],
    });
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
  async withdrawResale(
    @CurrentUser() user: JwtPayload,
    @Param("resaleId") resaleId: string,
  ) {
    const resale = (await firstValueFrom(
      this.ticketClient.send("ticket.withdraw_resale", {
        resale_id: resaleId,
        buyer_id: user.sub,
      }),
    )) as { ticket_id: string };

    // Bug corrigé : aucune confirmation n'était envoyée au vendeur après un
    // retrait — symétrique à notifyResaleListed/notifyResaleSold qui, eux,
    // couvrent déjà tout le reste du cycle de vie de l'annonce.
    this.notifyResaleWithdrawn(user.sub, resale.ticket_id).catch((err) =>
      this.logger.error(`Erreur notification retrait revente ${resaleId}: ${err?.message}`),
    );

    return resale;
  }

  private async notifyResaleWithdrawn(sellerId: string, ticketId: string): Promise<void> {
    if (!(await this.wantsResaleUpdates(sellerId))) return;

    const [seller, ticket] = await Promise.all([
      firstValueFrom(
        this.authClient.send("auth.get_user", { id: sellerId }),
      ) as Promise<{ email: string; first_name: string } | null>,
      firstValueFrom(
        this.ticketClient.send("ticket.get", { id: ticketId }),
      ) as Promise<{ event_name: string }>,
    ]);
    if (!seller?.email) return;

    this.notifClient.emit("notification.resale_withdrawn", {
      email: seller.email,
      firstName: seller.first_name,
      eventName: ticket.event_name,
    });
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
