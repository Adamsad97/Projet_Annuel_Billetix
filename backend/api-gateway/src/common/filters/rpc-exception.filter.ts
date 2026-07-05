import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { Response } from "express";

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const error = exception.getError() as {
      statusCode?: number;
      message?: string;
    };
    const status = error?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: error?.message ?? "Erreur interne du serveur",
      timestamp: new Date().toISOString(),
    });
  }
}
