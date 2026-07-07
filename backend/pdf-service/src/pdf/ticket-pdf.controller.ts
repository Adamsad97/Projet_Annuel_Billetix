import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientProxyFactory, Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { validatePayload } from '../common/validate-payload.util';
import { TicketPdfDto } from './dto/ticket-pdf.dto';
import { TicketPdfService } from './ticket-pdf.service';

@Controller()
export class TicketPdfController {
  private readonly logger = new Logger(TicketPdfController.name);
  private ticketClient: ClientProxy;

  constructor(
    private readonly pdfService: TicketPdfService,
    private readonly config: ConfigService,
  ) {
    // Client TCP vers ticket-service pour mettre à jour le pdf_url après génération
    this.ticketClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: this.config.get('TICKET_SERVICE_HOST', 'ticket-service'),
        port: parseInt(this.config.get('TICKET_SERVICE_PORT', '3005')),
      },
    });
  }

  @EventPattern('pdf.generate_ticket')
  async generateTicket(
    @Payload() rawData: unknown,
    @Ctx() ctx: RmqContext,
  ) {
    const channel = ctx.getChannelRef();
    const msg = ctx.getMessage();

    const result = await validatePayload(TicketPdfDto, rawData);
    if (result.valid === false) {
      this.logger.error(`Payload pdf.generate_ticket invalide, message écarté : ${result.message}`);
      channel.ack(msg);
      return;
    }
    const data = result.data;

    try {
      const pdfUrl = await this.pdfService.generate(data);

      // Mettre à jour le billet avec l'URL du PDF
      await firstValueFrom(
        this.ticketClient.send('ticket.set_pdf_url', {
          id: data.ticket_id,
          url: pdfUrl,
        }),
      );

      channel.ack(msg);
      this.logger.log(`PDF billet ${data.reference} généré et envoyé`);
    } catch (err) {
      this.logger.error(`Échec génération PDF ${data.reference} : ${err?.message}`);
      // Requeue pour ré-essai
      channel.nack(msg, false, true);
    }
  }
}
