import { Controller, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientProxyFactory, Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { handlePdfGenerationFailure } from '../common/pdf-retry.util';
import { validatePayload } from '../common/validate-payload.util';
import { PlatformConfigCache } from '../platform-config/platform-config.cache';
import { InvoicePdfDto } from './dto/invoice-pdf.dto';
import { InvoicePdfService } from './invoice-pdf.service';

const QUEUE = 'pdf_queue';

@Controller()
export class InvoicePdfController {
  private readonly logger = new Logger(InvoicePdfController.name);
  private orderClient: ClientProxy;

  constructor(
    private readonly pdfService: InvoicePdfService,
    private readonly config: ConfigService,
    private readonly platformConfig: PlatformConfigCache,
    @Inject('ADMIN_SERVICE') private readonly adminClient: ClientProxy,
  ) {
    // Client TCP vers order-service pour enregistrer l'invoice_url après génération
    this.orderClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: this.config.get('ORDER_SERVICE_HOST', 'order-service'),
        port: parseInt(this.config.get('ORDER_SERVICE_PORT', '3004')),
      },
    });
  }

  @EventPattern('pdf.generate_invoice')
  async generateInvoice(
    @Payload() rawData: unknown,
    @Ctx() rmqContext: RmqContext,
  ) {
    const channel = rmqContext.getChannelRef();
    const rmqMessage = rmqContext.getMessage();

    const result = await validatePayload(InvoicePdfDto, rawData);
    if (result.valid === false) {
      this.logger.error(`Payload pdf.generate_invoice invalide, message écarté : ${result.message}`);
      channel.ack(rmqMessage);
      return;
    }
    const data = result.data;

    try {
      const pdfUrl = await this.pdfService.generate(data);

      await firstValueFrom(
        this.orderClient.send('order.set_invoice_url', {
          id: data.order_id,
          url: pdfUrl,
        }),
      );

      channel.ack(rmqMessage);
      this.logger.log(`Facture ${data.reference} générée et enregistrée`);
    } catch (error) {
      const { pdf_generation_max_retry_attempts } = await this.platformConfig.get();
      await handlePdfGenerationFailure({
        channel,
        message: rmqMessage,
        queue: QUEUE,
        maxAttempts: pdf_generation_max_retry_attempts,
        adminClient: this.adminClient,
        logger: this.logger,
        template: 'facture',
        reference: data.reference,
        entityType: 'ORDER',
        entityId: data.order_id,
        error,
      });
    }
  }
}
