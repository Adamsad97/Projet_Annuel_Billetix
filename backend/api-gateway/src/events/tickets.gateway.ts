import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@Injectable()
@WebSocketGateway({
  cors: { origin: "*" },
  namespace: "/tickets",
})
export class TicketsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TicketsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      // Rejoindre une room propre à l'acheteur : "buyer:{userId}"
      await client.join(`buyer:${payload.sub}`);
      client.data.userId = payload.sub;
      // Les admins rejoignent aussi la room "admin" — alertes fraude/remboursements massifs
      if (payload.role === "ADMIN") {
        await client.join("admin");
      }
      this.logger.log(`Client connecté : ${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  // Abonnement au dashboard d'un événement : simple signal, les données passent par la route REST.
  @SubscribeMessage("dashboard:subscribe")
  handleDashboardSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { event_id: string },
  ) {
    if (data?.event_id) {
      client.join(`event:${data.event_id}`);
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      this.logger.log(`Client déconnecté : ${client.data.userId}`);
    }
  }

  // Appelé par le TicketController après un scan réussi
  notifyTicketScanned(
    buyerId: string,
    ticketData: {
      ticket_id: string;
      event_name: string;
      ticket_category_name: string;
      holder_first_name: string;
      holder_last_name: string;
      scanned_at: Date;
      status: string;
    },
  ) {
    this.server.to(`buyer:${buyerId}`).emit("ticket:scanned", ticketData);
  }

  // Signal de rafraîchissement après une vente ou un scan, sans données métier.
  notifyDashboardUpdate(eventId: string, reason: "sale" | "scan") {
    this.server
      .to(`event:${eventId}`)
      .emit("dashboard:changed", { event_id: eventId, reason });
  }

  // Poussé aux admins connectés quand un seuil d'alerte (litiges/remboursements) est franchi
  notifyAdminAlert(alert: {
    type: string;
    severity: "warning" | "critical";
    message: string;
  }) {
    this.server.to("admin").emit("admin:alert", alert);
  }
}
