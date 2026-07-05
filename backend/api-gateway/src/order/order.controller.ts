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
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
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
   * Si promo_code est fourni, on valide contre event-service et on calcule la remise.
   */
  @Post()
  @ApiOperation({
    summary: "Passer une commande (étape 2 — après réservation stock)",
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Record<string, unknown>,
  ) {
    let promoCodeId: string | undefined;
    let discountAmount = 0;

    const promoCode = dto.promo_code as string | undefined;
    const eventId = dto.event_id as string;

    if (promoCode && eventId) {
      const promoResult = (await firstValueFrom(
        this.eventClient.send("event.validate_promo_code", {
          event_id: eventId,
          code: promoCode,
        }),
      )) as {
        valid: boolean;
        message?: string;
        discount_type?: "PERCENTAGE" | "FIXED";
        discount_value?: number;
        promo_code_id?: string;
      };

      if (!promoResult.valid) {
        throw new BadRequestException(
          promoResult.message ?? "Code promo invalide.",
        );
      }

      promoCodeId = promoResult.promo_code_id;

      // Calculer la remise depuis les items fournis dans le DTO
      const items =
        (dto.items as { unit_price_ht: number; quantity: number }[]) ?? [];
      const subtotalHt = items.reduce(
        (sum, item) => sum + Number(item.unit_price_ht) * item.quantity,
        0,
      );

      discountAmount =
        promoResult.discount_type === "PERCENTAGE"
          ? parseFloat(
              (subtotalHt * (promoResult.discount_value / 100)).toFixed(2),
            )
          : Math.min(promoResult.discount_value, subtotalHt);
    }

    const order = await firstValueFrom(
      this.orderClient.send("order.create", {
        ...dto,
        buyer_id: user.sub,
        promo_code_id: promoCodeId ?? dto.promo_code_id,
        discount_amount:
          discountAmount || ((dto.discount_amount as number) ?? 0),
      }),
    );

    // Incrémenter l'usage du code promo (fire-and-forget)
    if (promoCodeId) {
      this.eventClient
        .send("event.increment_promo_uses", { id: promoCodeId })
        .subscribe();
    }

    return order;
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

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Annuler une commande" })
  cancel(@Param("id") id: string, @Body() dto: { reason?: string }) {
    return firstValueFrom(
      this.orderClient.send("order.cancel", { id, reason: dto.reason }),
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
