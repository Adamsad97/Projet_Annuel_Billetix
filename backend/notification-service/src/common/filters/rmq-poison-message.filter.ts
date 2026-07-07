import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

/**
 * Un message RMQ dont le traitement échoue (payload invalide rejeté par le
 * ValidationPipe, ou toute autre exception non attrapée) ne réussira jamais
 * en le retentant à l'identique. Sans ce filtre, l'exception empêcherait
 * l'appel à ack() en fin de handler : le message resterait non acquitté
 * (préfetch bloqué, puis requeue en boucle infinie au redémarrage du
 * service). On l'acquitte donc explicitement ici pour l'écarter proprement.
 */
@Catch()
export class RmqPoisonMessageFilter implements ExceptionFilter {
  private readonly logger = new Logger(RmqPoisonMessageFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reason = exception instanceof Error ? exception.message : JSON.stringify(exception);

    // Ce filtre global est aussi traversé par le petit serveur HTTP interne
    // (health check) — pas de contexte RMQ à acquitter dans ce cas, on se
    // contente de logger.
    if (host.getType() !== 'rpc') {
      this.logger.error(`Erreur (contexte ${host.getType()}) : ${reason}`);
      return;
    }

    const ctx = host.switchToRpc().getContext<RmqContext>();
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();

    this.logger.error(`Message écarté (payload invalide ou erreur de traitement) : ${reason}`);
    channel.ack(message);
  }
}
