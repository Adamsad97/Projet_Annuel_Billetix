import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

/** Acquitte un message RMQ en échec (il échouerait à l'identique) pour ne pas bloquer la file, en journalisant le motif. */
@Catch()
export class RmqPoisonMessageFilter implements ExceptionFilter {
  private readonly logger = new Logger(RmqPoisonMessageFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reason = this.describe(exception);

    // Le petit serveur HTTP interne (santé) répond en JSON : sans réponse,
    // la requête resterait suspendue jusqu'à expiration.
    if (host.getType() === 'http') {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      this.logger.error(`Erreur HTTP ${status} : ${reason}`);
      host
        .switchToHttp()
        .getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>()
        .status(status)
        .json({ statusCode: status, message: status === 500 ? 'Erreur interne du service.' : reason });
      return;
    }
    if (host.getType() !== 'rpc') {
      this.logger.error(`Erreur (contexte ${host.getType()}) : ${reason}`);
      return;
    }

    const rpcContext = host.switchToRpc().getContext<RmqContext>();
    const pattern = rpcContext.getPattern();
    this.logger.error(`Message « ${pattern} » écarté (payload invalide ou erreur de traitement) : ${reason}`);
    rpcContext.getChannelRef().ack(rpcContext.getMessage());
  }

  /** Motif lisible : liste des champs refusés pour une erreur de validation. */
  private describe(exception: unknown): string {
    if (exception instanceof BadRequestException) {
      const response = exception.getResponse() as { message?: unknown };
      if (Array.isArray(response.message)) return response.message.join(' ; ');
    }
    return exception instanceof Error ? exception.message : JSON.stringify(exception);
  }
}
