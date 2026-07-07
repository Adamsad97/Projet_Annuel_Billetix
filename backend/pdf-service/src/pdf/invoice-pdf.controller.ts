import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientProxyFactory, Ctx, EventPattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { validatePayload } from '../common/validate-payload.util';
import { InvoicePdfDto } from './dto/invoice-pdf.dto';
import { InvoicePdfService } from './invoice-pdf.service';

@Controller()
export class InvoicePdfController {
  private readonly logger = new Logger(InvoicePdfController.name);
  private orderClient: ClientProxy;

  constructor(
    private readonly pdfService: InvoicePdfService,
    private readonly config: ConfigService,
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
    @Ctx() ctx: RmqContext,
  ) {
    const channel = ctx.getChannelRef();
    const msg = ctx.getMessage();

    const result = await validatePayload(InvoicePdfDto, rawData);
    if (result.valid === false) {
      this.logger.error(`Payload pdf.generate_invoice invalide, message écarté : ${result.message}`);
      channel.ack(msg);
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

      channel.ack(msg);
      this.logger.log(`Facture ${data.reference} générée et enregistrée`);
    } catch (err) {
      this.logger.error(`Échec génération facture ${data.reference} : ${err?.message}`);
      channel.nack(msg, false, true);
    }
  }
}
