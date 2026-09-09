import { Controller, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientProxyFactory, Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { handlePdfGenerationFailure } from '../common/pdf-retry.util';
import { validatePayload } from '../common/validate-payload.util';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { TicketPdfDto } from './dto/ticket-pdf.dto';
import { TicketPdfService } from './ticket-pdf.service';

const QUEUE = 'pdf_queue';

@Controller()
export class TicketPdfController {
  private readonly logger = new Logger(TicketPdfController.name);
  private ticketClient: ClientProxy;

  constructor(
    private readonly pdfService: TicketPdfService,
    private readonly config: ConfigService,
    private readonly platformConfig: PlatformConfigCache,
    @Inject('ADMIN_SERVICE') private readonly adminClient: ClientProxy,
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
    @Ctx() rmqContext: RmqContext,
  ) {
    const channel = rmqContext.getChannelRef();
    const rmqMessage = rmqContext.getMessage();

    const result = await validatePayload(TicketPdfDto, rawData);
    if (result.valid === false) {
      this.logger.error(`Payload pdf.generate_ticket invalide, message écarté : ${result.message}`);
      channel.ack(rmqMessage);
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

      channel.ack(rmqMessage);
      this.logger.log(`PDF billet ${data.reference} généré et envoyé`);
    } catch (error) {
      const { pdf_generation_max_retry_attempts } = await this.platformConfig.get();
      await handlePdfGenerationFailure({
        channel,
        message: rmqMessage,
        queue: QUEUE,
        maxAttempts: pdf_generation_max_retry_attempts,
        adminClient: this.adminClient,
        logger: this.logger,
        template: 'billet',
        reference: data.reference,
        entityType: 'TICKET',
        entityId: data.ticket_id,
        error,
      });
    }
  }
}
