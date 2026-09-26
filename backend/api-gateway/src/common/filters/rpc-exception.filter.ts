import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { RpcException } from "@nestjs/microservices";
import { Response } from "express";

/** Erreur métier telle que renvoyée par un microservice (RpcException). */
interface ServiceError {
  statusCode?: number;
  message?: string;
  code?: string;
}

/**
 * Traduit en réponse HTTP les erreurs des microservices, en conservant leur
 * code métier (ex. SESSION_IDLE) : le site adapte sa réaction sans dépendre
 * du texte du message.
 *
 * Bug corrigé : une erreur renvoyée par un microservice n'arrive pas ici
 * comme une RpcException mais comme un simple objet { statusCode, message,
 * code } — le filtre par défaut de Nest n'en gardait que statusCode et
 * message, le code était perdu. Toute autre erreur (HttpException, erreur
 * inattendue) reste traitée par le filtre par défaut.
 */
@Catch()
export class RpcExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const error = RpcExceptionFilter.toServiceError(exception);
    if (!error || host.getType() !== "http") {
      super.catch(exception, host);
      return;
    }
    const status = error.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        message: error.message ?? "Erreur interne du serveur",
        ...(error.code ? { code: error.code } : {}),
        timestamp: new Date().toISOString(),
      });
  }

  /** Erreur de microservice reconnue, ou null pour tout le reste. */
  static toServiceError(exception: unknown): ServiceError | null {
    if (exception instanceof RpcException) {
      const error = exception.getError();
      return typeof error === "object" && error !== null ? (error as ServiceError) : { message: String(error) };
    }
    if (
      !(exception instanceof HttpException) &&
      !(exception instanceof Error) &&
      typeof exception === "object" &&
      exception !== null &&
      typeof (exception as ServiceError).statusCode === "number"
    ) {
      return exception as ServiceError;
    }
    return null;
  }
}
