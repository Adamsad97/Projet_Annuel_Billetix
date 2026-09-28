import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";

const REQUEST_TIMEOUT_KEY = "requestTimeoutMs";
// Réglage technique (pas un paramètre métier) : surchargeable par REQUEST_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS = 20_000;

/** Délai propre à une route plus longue que la moyenne (envoi de masse, fichier…). */
export const RequestTimeout = (ms: number) => SetMetadata(REQUEST_TIMEOUT_KEY, ms);

/**
 * Si un microservice ne répond pas, la requête échoue proprement (504) au
 * lieu de rester suspendue jusqu'à la coupure du navigateur.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly defaultMs: number;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.defaultMs = Number(config.get("REQUEST_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ms =
      this.reflector.getAllAndOverride<number | undefined>(REQUEST_TIMEOUT_KEY, [context.getHandler(), context.getClass()]) ??
      this.defaultMs;
    return next.handle().pipe(
      timeout(ms),
      catchError((error) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new GatewayTimeoutException("Le service met trop de temps à répondre. Veuillez réessayer dans un instant.")
            : error,
        ),
      ),
    );
  }
}
