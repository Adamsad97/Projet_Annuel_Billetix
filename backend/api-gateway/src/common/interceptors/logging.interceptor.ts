import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

export const REQUEST_ID_HEADER = "x-request-id";

/** Journal de chaque requête avec un identifiant de corrélation (x-request-id), renvoyé dans la réponse. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string; user?: { sub?: string } }>();
    const response = http.getResponse<Response>();

    const incoming = request.headers[REQUEST_ID_HEADER];
    const requestId = typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = Date.now();
    // URL sans la chaîne de requête : pas de jeton ni d'email dans les journaux.
    const route = `${request.method} ${request.path}`;
    const who = () => (request.user?.sub ? ` user=${request.user.sub}` : "");

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${route} ${response.statusCode} ${Date.now() - startedAt}ms${who()} [${requestId}]`),
        error: (error: unknown) => {
          // Erreur d'un microservice : objet { statusCode, message } transmis tel quel.
          const rpcStatus = (error as { statusCode?: unknown })?.statusCode;
          const status = error instanceof HttpException ? error.getStatus() : typeof rpcStatus === "number" ? rpcStatus : 500;
          const line = `${route} ${status} ${Date.now() - startedAt}ms${who()} [${requestId}]`;
          if (status >= 500) this.logger.error(line);
          else this.logger.warn(line);
        },
      }),
    );
  }
}
