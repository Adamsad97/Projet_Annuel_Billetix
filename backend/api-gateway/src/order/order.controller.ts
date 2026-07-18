import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";

@ApiTags("orders")
@ApiBearerAuth()
@Controller("orders")
export class OrderController {
  constructor(
    @Inject("ORDER_SERVICE") private readonly orderClient: ClientProxy,
  ) {}

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
   */
  @Post()
  @ApiOperation({
    summary: "Passer une commande (étape 2 — après réservation stock)",
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    return firstValueFrom(
      this.orderClient.send("order.create", {
        ...dto,
        buyer_id: user.sub,
      }),
    );
  }

  @Get("me")
  @ApiOperation({ summary: "Mes commandes" })
  myOrders(@CurrentUser() user: JwtPayload) {
    return firstValueFrom(
      this.orderClient.send("order.list_by_buyer", { buyer_id: user.sub }),
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Détail d'une commande" })
  getById(@Param("id") id: string) {
    return firstValueFrom(this.orderClient.send("order.get", { id }));
  }

  @Get(":id/invoice")
  @ApiOperation({
    summary: "Télécharger la facture d'une commande (URL du PDF)",
  })
  async getInvoice(@Param("id") id: string) {
    const { order } = (await firstValueFrom(
      this.orderClient.send("order.get", { id }),
    )) as { order: { invoice_url: string | null } };

    if (!order.invoice_url) {
      throw new BadRequestException(
        "Facture pas encore disponible pour cette commande.",
      );
    }
    return { invoice_url: order.invoice_url };
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
