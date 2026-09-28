import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

type RpcError = { statusCode: number; message: unknown };

function isRpcError(value: unknown): value is RpcError {
  return typeof value === 'object' && value !== null && typeof (value as RpcError).statusCode === 'number';
}

/**
 * Filtre global des messages internes. Sans lui, toute erreur qui n'est pas
 * une RpcException — en particulier la réponse d'erreur d'un autre service
 * appelé ({ statusCode: 404, message: "Commande introuvable" }) — était
 * remplacée par « Internal server error » : le vrai motif et son statut
 * étaient perdus. Ici :
 *   - RpcException : transmise telle quelle ;
 *   - erreur d'un service appelé : relayée avec son statut et son message ;
 *   - HttpException (levée par erreur dans un service) : convertie ;
 *   - toute autre erreur : journalisée, puis 500 générique (aucun détail
 *     technique renvoyé à l'appelant).
 */
@Catch()
export class AllRpcExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('RpcExceptions');

  catch(exception: unknown, host: ArgumentsHost): Observable<never> | void {
    const error = this.normalize(exception);
    // Application hybride : le petit serveur HTTP (santé) répond en JSON.
    if (host.getType() === 'http') {
      host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>().status(error.statusCode).json(error);
      return;
    }
    return throwError(() => error);
  }

  private normalize(exception: unknown): RpcError {
    if (exception instanceof RpcException) {
      const error = exception.getError();
      return typeof error === 'string' ? { statusCode: 400, message: error } : (error as RpcError);
    }
    if (isRpcError(exception)) {
      return { statusCode: exception.statusCode, message: exception.message };
    }
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message = typeof response === 'object' && response !== null && 'message' in response ? (response as { message: unknown }).message : response;
      return { statusCode: exception.getStatus(), message };
    }
    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    return { statusCode: 500, message: 'Erreur interne du service.' };
  }
}
