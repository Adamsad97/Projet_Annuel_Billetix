import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
  constructor(
    @Inject("TICKET_SERVICE") private readonly ticketClient: ClientProxy,
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
    @Inject("PAYMENT_SERVICE") private readonly paymentClient: ClientProxy,
    private readonly ticketsGateway: TicketsGateway,
  ) {}

  // ─── Acheteur ────────────────────────────────────────────────────────────────

  @Get("order/:orderId")
  @ApiOperation({ summary: "Billets d'une commande" })
  getByOrder(@Param("orderId") orderId: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.get_by_order", { order_id: orderId }),
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Détail d'un billet" })
  getById(@Param("id") id: string) {
    return firstValueFrom(this.ticketClient.send("ticket.get", { id }));
  }

  // ─── Revente ────────────────────────────────────────────────────────────────

  @Post(":id/request-resale")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Remettre un billet en vente" })
  requestResale(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: { original_order_id: string; resale_price: number },
  ) {
    return firstValueFrom(
      this.ticketClient.send("ticket.request_resale", {
        ticket_id: id,
        buyer_id: user.sub,
        original_order_id: dto.original_order_id,
        resale_price: dto.resale_price,
      }),
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

  @Get("resale/:resaleId")
  @ApiOperation({ summary: "Détail d'une offre de revente" })
  getResale(@Param("resaleId") resaleId: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.get_resale", { id: resaleId }),
    );
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
      commission_rate: number;
    },
  ) {
    // 1. Récupérer l'offre de revente
    const resale = await firstValueFrom(
      this.ticketClient.send("ticket.get_resale", { id: resaleId }),
    );

    // 2. Créer une commande pour le nouvel acheteur
    const { order } = await firstValueFrom(
      this.orderClient.send("order.create", {
        buyer_id: user.sub,
        event_id: resale.event_id,
        items: [
          {
            ticket_category_id: resale.ticket_category_id,
            quantity: 1,
            unit_price_ht: resale.resale_price,
            holder_first_name: dto.billing_first_name,
            holder_last_name: dto.billing_last_name,
          },
        ],
        commission_rate: dto.commission_rate,
        ...dto,
      }),
    );

    // 3. Créer le payment intent Stripe
    const payment = await firstValueFrom(
      this.paymentClient.send("payment.create_intent", {
        order_id: order.id,
        amount_ttc: order.total_amount_ttc,
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

    // 2. Transférer le billet + marquer la revente SOLD
    const { resale, originalOrderId } = await firstValueFrom(
      this.ticketClient.send("ticket.complete_resale", {
        resale_id: resaleId,
        new_buyer_id: user.sub,
        new_order_id: dto.order_id,
      }),
    );

    // 3. Rembourser l'acheteur original
    await firstValueFrom(
      this.paymentClient.send("payment.refund", { order_id: originalOrderId }),
    );

    return { success: true, resale };
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
    const response = await firstValueFrom(
      this.ticketClient.send("ticket.scan", { ...dto, agent_id: user.sub }),
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
    }

    return response;
  }

  @Post("sync-offline")
  @HttpCode(HttpStatus.OK)
  @Roles("AGENT", "ORGANIZER")
  @ApiOperation({
    summary: "Synchroniser les scans hors-ligne (AGENT/ORGANIZER)",
  })
  syncOffline(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { event_id: string; entries: unknown[] },
  ) {
    return firstValueFrom(
      this.ticketClient.send("ticket.sync_offline", {
        agent_id: user.sub,
        ...dto,
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

  @Post("event/:eventId/agents")
  @Roles("ORGANIZER")
  @ApiOperation({ summary: "Assigner un agent à l'événement (ORGANIZER)" })
  assignAgent(
    @CurrentUser() user: JwtPayload,
    @Param("eventId") eventId: string,
    @Body() dto: { user_id: string; is_supervisor?: boolean },
  ) {
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
  getAgents(@Param("eventId") eventId: string) {
    return firstValueFrom(
      this.ticketClient.send("ticket.get_agents", { event_id: eventId }),
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
