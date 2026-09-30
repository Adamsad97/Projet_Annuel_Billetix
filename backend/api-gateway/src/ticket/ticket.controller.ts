import {
  BadRequestException,
  ConflictException,
  NotFoundException,
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
import { formatEventDate, formatEventDateTime } from "../common/event-date";
import { GiftTicketDto } from "./dto/gift-ticket.dto";
import { RequestTransferRevertDto } from "./dto/transfer-revert.dto";
import { ScanResult } from "./scan-result.enum";
import { ReasonDto } from "../common/dto/common.dto";
import { AssignAgentDto,
  AssignAgentsBulkDto, OrderRefDto, RequestResaleDto, ScanTicketDto, SyncOfflineScansDto } from "./dto/ticket-actions.dto";
import { BillingDto } from "../order/dto/order.dto";
import { UuidPipe } from "../common/pipes/uuid.pipe";
import { EventOwner } from "../common/guards/event-owner.guard";
import { findScheduleConflict, type ScheduledEvent } from "./agent-schedule";
import { assertCanBuyTickets, canHoldTickets } from "../common/purchase-roles";


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

  // ─── Acheteur ────────────────────────────────────────────────────────────────

  /**
   * Bug corrigé : aucune vérification que la commande appartient bien à
   * l'appelant — n'importe quel compte connecté pouvait lister les billets
   * de n'importe quelle commande en devinant/récupérant son ID.
   */
  @Get("order/:orderId")
  @ApiOperation({ summary: "Billets d'une commande (le sien uniquement)" })
  async getByOrder(@CurrentUser() user: JwtPayload, @Param("orderId", UuidPipe) orderId: string) {
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
    @Param("transferId", UuidPipe) transferId: string,
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
  // ADMIN : consultation en mode aperçu du back-office (achat toujours bloqué).
  @Roles("BUYER", "ADMIN")
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
    @Param("id", UuidPipe) id: string,
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
  async getById(@CurrentUser() user: JwtPayload, @Param("id", UuidPipe) id: string) {
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
    @Param("id", UuidPipe) id: string,
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
        message: "Pour offrir un billet, confirmez d'abord votre identité en vous reconnectant.",
      });
    }

    const [sender, recipient] = await Promise.all([
      firstValueFrom(this.authClient.send<AccountSummary>("auth.get_user", { id: user.sub })),
      firstValueFrom(this.authClient.send<AccountSummary | null>("auth.find_by_email", { email: dto.recipient_email })),
    ]);
    if (recipient?.id === user.sub) {
      throw new BadRequestException("Vous ne pouvez pas vous offrir votre propre billet.");
    }
    const recipientEligible =
      recipient &&
      recipient.is_email_verified &&
      recipient.is_active !== false &&
      !recipient.is_suspended &&
      // Ni administrateur ni agent de contrôle : comptes sans billets.
      canHoldTickets(recipient.role);
    if (!recipientEligible) {
      throw new BadRequestException(
        "Aucun compte BilleTix actif et vérifié n'est associé à cet email. " +
          "Demandez à la personne de créer son compte (et de valider son email), puis réessayez.",
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
      eventDate: formatEventDate(ticket.event_start_at),
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
    @Param("id", UuidPipe) id: string,
    @Body() dto: RequestResaleDto,
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
  getActiveResale(@Param("id", UuidPipe) id: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.get_active_resale_by_ticket", { ticket_id: id }),
    );
  }

  // ADMIN : consultation en mode aperçu du back-office (achat toujours bloqué).
  @Roles("BUYER", "ADMIN")
  @Get("resale/event/:eventId")
  @ApiOperation({ summary: "Billets en revente pour un événement (acheteur connecté)" })
  listResaleByEvent(@Param("eventId", UuidPipe) eventId: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.list_resale_by_event", {
        event_id: eventId,
      }),
    );
  }

  // ADMIN : consultation en mode aperçu du back-office (achat toujours bloqué).
  @Roles("BUYER", "ADMIN")
  @Get("resale/:resaleId")
  @ApiOperation({ summary: "Détail d'une offre de revente (acheteur connecté)" })
  async getResale(@Param("resaleId", UuidPipe) resaleId: string) {
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
    @Param("resaleId", UuidPipe) resaleId: string,
    @Body()
    dto: BillingDto,
  ) {
    // Même règle que la réservation classique (order.controller.ts) : un
    // compte administrateur n'achète jamais, revente comprise — y compris
    // depuis le mode aperçu du back-office.
    assertCanBuyTickets(user.role);
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
    @Param("resaleId", UuidPipe) resaleId: string,
    @Body() dto: OrderRefDto,
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

    // 3. Rembourser le vendeur du prix de revente de CE billet.
    // Bug corrigé : le remboursement portait sur toute la commande d'origine
    // (tous ses billets), et la commande entière était marquée remboursée
    // alors que ses autres billets restent valables. Désormais : remboursement
    // partiel du seul prix de revente (plafonné au prix d'achat), sur le
    // moyen de paiement d'origine ; le reversement de l'organisateur est
    // réduit d'autant (payment-service), la commande de revente le compensant.
    const resaleAmount = Number(resale.resale_price);
    if (resaleAmount > 0) {
      try {
        await firstValueFrom(
          this.paymentClient.send("payment.refund", {
            order_id: originalOrderId,
            amount_cents: Math.round(resaleAmount * 100),
          }),
        );
        // La commande d'origine reste confirmée : seul le montant remboursé
        // est enregistré (déduit des chiffres d'affaires).
        await firstValueFrom(
          this.orderClient.send("order.record_partial_refund", { id: originalOrderId, amount_ttc: resaleAmount }),
        );
      } catch (err) {
        // La revente est déjà actée (billet transféré) : on ne la défait pas,
        // mais le remboursement manquant doit être traité par un admin.
        const message = (err as { message?: string })?.message ?? String(err);
        this.logger.error(`Remboursement du vendeur échoué — revente ${resale.id}, commande ${originalOrderId} : ${message}`);
        this.adminClient
          .send("admin.log_action", {
            action: "CUSTOM",
            entity_type: "ORDER",
            entity_id: originalOrderId,
            performed_by: "system",
            reason: `Revente ${resale.id} : remboursement du vendeur (${resaleAmount.toFixed(2)} €) à effectuer manuellement — ${message}`,
          })
          .subscribe({ error: () => undefined });
      }
    }

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
      eventDate: formatEventDate(ticket.event_start_at),
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
    @Param("resaleId", UuidPipe) resaleId: string,
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
  @EventOwner({ body: "event_id" })
  @ApiOperation({ summary: "Scanner un QR code (AGENT/ORGANIZER)" })
  async scan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ScanTicketDto,
  ) {
    const isOrganizer = user.role === "ORGANIZER";

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
        // Fuseau de l'événement (heure affichée = heure locale du lieu).
        const eventTimezone = await firstValueFrom(
          this.eventClient.send<{ timezone?: string }>("event.get", { id: dto.event_id }),
        )
          .then((event) => event?.timezone)
          .catch(() => undefined);
        const sameAsTitle =
          !scannedTicket.artist_name ||
          scannedTicket.artist_name.trim().toLowerCase() === String(scannedTicket.event_name ?? "").trim().toLowerCase();
        this.notifClient.emit("notification.ticket_scanned", {
          email: scannedTicket.buyer_email,
          firstName: scannedTicket.holder_first_name,
          eventName: scannedTicket.event_name,
          eventDate: formatEventDate(scannedTicket.event_start_at, eventTimezone),
          venueName: scannedTicket.event_venue_name,
          eventCity: scannedTicket.event_city,
          ...(sameAsTitle ? {} : { artistName: scannedTicket.artist_name }),
          categoryName: scannedTicket.ticket_category_name,
          holderName: `${scannedTicket.holder_first_name} ${scannedTicket.holder_last_name}`,
          scannedAt: formatEventDateTime(scannedTicket.scanned_at, eventTimezone),
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

  /**
   * Paquet hors ligne de l'appareil de contrôle, à télécharger avant
   * l'ouverture des portes : clé publique de vérification des QR signés,
   * empreintes et statuts des billets, état et dates de l'événement, fenêtre
   * de contrôle. Aucun jeton ni donnée personnelle. Organisateur de
   * l'événement ou agent affecté (vérifié par ticket-service).
   */
  @Get("event/:eventId/offline-pack")
  @Roles("AGENT", "ORGANIZER")
  @EventOwner({ param: "eventId" })
  @ApiOperation({ summary: "Paquet de contrôle hors ligne d'un événement (AGENT/ORGANIZER)" })
  async offlinePack(
    @CurrentUser() user: JwtPayload,
    @Param("eventId", UuidPipe) eventId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set("Cache-Control", "no-store, private");
    return firstValueFrom(
      this.ticketClient.send("ticket.offline_pack", {
        event_id: eventId,
        requester_id: user.sub,
        is_organizer: user.role === "ORGANIZER",
      }),
    );
  }

  /** Entrées de l'événement, tous agents confondus (écran de scan). */
  @Get("event/:eventId/entry-stats")
  @Roles("AGENT", "ORGANIZER")
  @EventOwner({ param: "eventId" })
  @ApiOperation({ summary: "Entrées d'un événement : billets scannés sur billets attendus (AGENT/ORGANIZER)" })
  entryStats(@CurrentUser() user: JwtPayload, @Param("eventId", UuidPipe) eventId: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.entry_stats", {
        event_id: eventId,
        requester_id: user.sub,
        is_organizer: user.role === "ORGANIZER",
      }),
    );
  }

  @Post("sync-offline")
  @EventOwner({ body: "event_id" })
  @HttpCode(HttpStatus.OK)
  @Roles("AGENT", "ORGANIZER")
  @ApiOperation({
    summary: "Synchroniser les scans hors-ligne (AGENT/ORGANIZER)",
  })
  async syncOffline(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SyncOfflineScansDto,
  ) {
    const isOrganizer = user.role === "ORGANIZER";

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
  @EventOwner({ param: "eventId" })
  @ApiOperation({ summary: "Logs de scan d'un événement (ORGANIZER/ADMIN)" })
  getScanLogs(@Param("eventId", UuidPipe) eventId: string) {
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
  /**
   * Invite un agent de contrôle par son email : compte agent créé au besoin
   * (lien pour choisir son mot de passe), puis affecté à l'événement. Une
   * adresse de compte acheteur/organisateur est refusée par auth-service.
   */
  @Post("event/:eventId/agents")
  @Roles("ORGANIZER")
  @EventOwner({ param: "eventId" })
  @ApiOperation({ summary: "Inviter un agent de contrôle par email (ORGANIZER)" })
  async assignAgent(
    @CurrentUser() user: JwtPayload,
    @Param("eventId", UuidPipe) eventId: string,
    @Body() dto: AssignAgentDto,
  ) {
    const context = await this.agentInvitationContext(user.sub, eventId);
    return this.inviteOneAgent(user.sub, eventId, dto, context);
  }

  /**
   * Invitation groupée : chaque agent est traité indépendamment — une
   * adresse refusée n'empêche pas les autres. Résultat ligne par ligne.
   */
  @Post("event/:eventId/agents/bulk")
  @Roles("ORGANIZER")
  @EventOwner({ param: "eventId" })
  @ApiOperation({ summary: "Inviter plusieurs agents de contrôle en une fois (ORGANIZER)" })
  async assignAgentsBulk(
    @CurrentUser() user: JwtPayload,
    @Param("eventId", UuidPipe) eventId: string,
    @Body() dto: AssignAgentsBulkDto,
  ) {
    const context = await this.agentInvitationContext(user.sub, eventId);
    const results: Array<{ email: string; status: "invited" | "assigned" | "error"; message?: string }> = [];
    const seen = new Set<string>();
    for (const agent of dto.agents) {
      const email = agent.email.toLowerCase();
      if (seen.has(email)) {
        results.push({ email: agent.email, status: "error", message: "Adresse en double dans la liste." });
        continue;
      }
      seen.add(email);
      try {
        const invited = await this.inviteOneAgent(user.sub, eventId, agent, context);
        results.push({ email: agent.email, status: invited.account_created ? "invited" : "assigned" });
      } catch (err) {
        const message =
          (err as { response?: { message?: string } })?.response?.message ??
          (err as { message?: string })?.message ??
          "Invitation impossible.";
        results.push({ email: agent.email, status: "error", message: String(message) });
      }
    }
    return { results };
  }

  /** Événement et nom de l'organisateur, repris dans l'email d'invitation. */
  private async agentInvitationContext(organizerId: string, eventId: string) {
    const [event, organizerProfile, organizer] = await Promise.all([
      firstValueFrom(
        this.eventClient.send<ScheduledEvent & { timezone?: string }>("event.get", { id: eventId }),
      ),
      firstValueFrom(
        this.userClient.send<{ display_name?: string } | null>("user.get_organizer_profile", { user_id: organizerId }),
      ).catch(() => null),
      firstValueFrom(
        this.authClient.send<{ first_name: string; last_name: string }>("auth.get_user", { id: organizerId }),
      ).catch(() => null),
    ]);
    return {
      event,
      event_name: event.title,
      event_date: formatEventDate(event.start_date, event.timezone),
      organizer_name:
        organizerProfile?.display_name ?? (organizer ? `${organizer.first_name} ${organizer.last_name}` : "L'organisateur"),
    };
  }

  private async inviteOneAgent(
    organizerId: string,
    eventId: string,
    dto: AssignAgentDto,
    context: { event: ScheduledEvent; event_name: string; event_date: string; organizer_name: string },
  ): Promise<{ user_id: string; account_created: boolean }> {
    // Déjà affecté : refus avant tout email.
    const existing = await firstValueFrom(
      this.authClient.send<{ id: string } | null>("auth.find_by_email", { email: dto.email }),
    );
    if (existing) {
      const agents = await firstValueFrom(
        this.ticketClient.send<Array<{ user_id: string }>>("ticket.get_agents", { event_id: eventId }),
      );
      if (agents.some((agent) => agent.user_id === existing.id)) {
        throw new ConflictException("Cet agent est déjà affecté à l'événement.");
      }

      // Un agent ne contrôle qu'un événement à la fois : aucun chevauchement
      // de créneaux avec ses autres affectations.
      const assignedIds = await firstValueFrom(
        this.ticketClient.send<string[]>("ticket.get_agent_events", { user_id: existing.id }),
      );
      if (assignedIds.length > 0) {
        const assigned = await firstValueFrom(
          this.eventClient.send<ScheduledEvent[]>("event.get_by_ids", { ids: assignedIds }),
        );
        const conflict = findScheduleConflict(context.event, assigned);
        if (conflict) {
          throw new ConflictException(
            `Cet agent contrôle déjà « ${conflict.title} » (${formatEventDate(conflict.start_date)}) sur un créneau qui chevauche cet événement.`,
          );
        }
      }
    }

    const invited = await firstValueFrom(
      this.authClient.send<{ user_id: string; created: boolean }>("auth.invite_agent", {
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        event_name: context.event_name,
        event_date: context.event_date,
        organizer_name: context.organizer_name,
      }),
    );

    await firstValueFrom(
      this.ticketClient.send("ticket.assign_agent", {
        user_id: invited.user_id,
        event_id: eventId,
        assigned_by: organizerId,
        is_supervisor: dto.is_supervisor,
      }),
    );
    return { user_id: invited.user_id, account_created: invited.created };
  }

  /** Agents de l'événement, avec nom, email et état de l'invitation. */
  @Get("event/:eventId/agents")
  @Roles("ORGANIZER", "ADMIN")
  @EventOwner({ param: "eventId" })
  @ApiOperation({
    summary: "Liste des agents d'un événement (ORGANIZER/ADMIN)",
  })
  async getAgents(@Param("eventId", UuidPipe) eventId: string) {
    const agents = await firstValueFrom(
      this.ticketClient.send<Array<{ user_id: string; created_at: string; is_supervisor: boolean; last_activity_at: string | null }>>(
        "ticket.get_agents",
        { event_id: eventId },
      ),
    );
    if (agents.length === 0) return [];
    const accounts = await firstValueFrom(
      this.authClient.send<Array<{ id: string; email: string; first_name: string; last_name: string; is_email_verified: boolean }>>(
        "auth.get_users_by_ids",
        { ids: agents.map((agent) => agent.user_id) },
      ),
    );
    const byId = new Map(accounts.map((account) => [account.id, account]));
    return agents.map((agent) => {
      const account = byId.get(agent.user_id);
      return {
        user_id: agent.user_id,
        email: account?.email ?? null,
        first_name: account?.first_name ?? null,
        last_name: account?.last_name ?? null,
        // Compte créé par invitation, mot de passe pas encore choisi.
        invitation_pending: account ? !account.is_email_verified : false,
        is_supervisor: agent.is_supervisor,
        assigned_at: agent.created_at,
        last_activity_at: agent.last_activity_at,
      };
    });
  }

  /**
   * Nouveau lien d'activation pour un agent qui n'a pas encore choisi son
   * mot de passe (invitation expirée ou égarée).
   */
  @Post("event/:eventId/agents/:userId/resend-invitation")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @EventOwner({ param: "eventId" })
  @ApiOperation({ summary: "Renvoyer l'invitation d'un agent pas encore activé (ORGANIZER)" })
  async resendAgentInvitation(
    @CurrentUser() user: JwtPayload,
    @Param("eventId", UuidPipe) eventId: string,
    @Param("userId", UuidPipe) userId: string,
  ) {
    const agents = await firstValueFrom(
      this.ticketClient.send<Array<{ user_id: string }>>("ticket.get_agents", { event_id: eventId }),
    );
    if (!agents.some((agent) => agent.user_id === userId)) {
      throw new NotFoundException("Cet agent n'est pas affecté à l'événement.");
    }
    const context = await this.agentInvitationContext(user.sub, eventId);
    return firstValueFrom(
      this.authClient.send("auth.resend_agent_invitation", {
        user_id: userId,
        event_name: context.event_name,
        event_date: context.event_date,
        organizer_name: context.organizer_name,
      }),
    );
  }

  @Delete("event/:eventId/agents/:userId")
  @HttpCode(HttpStatus.OK)
  @Roles("ORGANIZER")
  @EventOwner({ param: "eventId" })
  @ApiOperation({ summary: "Révoquer un agent de l'événement (ORGANIZER)" })
  async removeAgent(
    @CurrentUser() user: JwtPayload,
    @Param("eventId", UuidPipe) eventId: string,
    @Param("userId", UuidPipe) userId: string,
  ) {
    return firstValueFrom(
      this.ticketClient.send("ticket.remove_agent", {
        user_id: userId,
        event_id: eventId,
      }),
    );
  }

  /** Événements auxquels l'agent connecté est affecté (écran de scan). */
  @Get("agent/events")
  @Roles("AGENT")
  @ApiOperation({ summary: "Mes événements à contrôler (AGENT)" })
  async agentEvents(@CurrentUser() user: JwtPayload) {
    const ids = await firstValueFrom(
      this.ticketClient.send<string[]>("ticket.get_agent_events", { user_id: user.sub }),
    );
    if (ids.length === 0) return [];
    return firstValueFrom(this.eventClient.send("event.get_by_ids", { ids }));
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  @Post(":id/invalidate")
  @HttpCode(HttpStatus.OK)
  @Roles("ADMIN")
  @ApiOperation({ summary: "Invalider un billet (ADMIN)" })
  invalidate(
    @CurrentUser() user: JwtPayload,
    @Param("id", UuidPipe) id: string,
    @Body() dto: ReasonDto,
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
