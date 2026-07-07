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
      this.logger.log(`Client connecté : ${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  // Le frontend organisateur appelle ceci en visualisant le dashboard d'un
  // événement précis — l'autorisation réelle reste portée par la route REST
  // (GET /events/:id/dashboard vérifie la propriété), ce canal ne pousse
  // qu'un signal de rafraîchissement, jamais de données sensibles.
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

  // Appelé après une vente (paiement confirmé) ou un scan — signal léger,
  // le frontend organisateur doit refaire GET /events/:id/dashboard pour les
  // données à jour (pas de données métier poussées directement dans le socket).
  notifyDashboardUpdate(eventId: string, reason: "sale" | "scan") {
    this.server
      .to(`event:${eventId}`)
      .emit("dashboard:changed", { event_id: eventId, reason });
  }
}
