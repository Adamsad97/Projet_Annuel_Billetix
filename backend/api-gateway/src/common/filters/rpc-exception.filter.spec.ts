import { ForbiddenException } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { RpcExceptionFilter } from "./rpc-exception.filter";

describe("RpcExceptionFilter", () => {
  const httpHost = () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      getType: () => "http",
      switchToHttp: () => ({ getResponse: () => response }),
    };
    return { host: host as never, response };
  };

  it("conserve le code métier d'une erreur renvoyée par un microservice (objet simple)", () => {
    const { host, response } = httpHost();
    new RpcExceptionFilter().catch({ statusCode: 401, message: "Session expirée", code: "SESSION_IDLE" }, host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: "Session expirée", code: "SESSION_IDLE" }),
    );
  });

  it("traite aussi une RpcException", () => {
    const { host, response } = httpHost();
    new RpcExceptionFilter().catch(new RpcException({ statusCode: 409, message: "Conflit", code: "X" }), host);

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, code: "X" }));
  });

  it("laisse les erreurs HTTP et inattendues au filtre par défaut de Nest", () => {
    expect(RpcExceptionFilter.toServiceError(new ForbiddenException("non"))).toBeNull();
    expect(RpcExceptionFilter.toServiceError(new Error("boom"))).toBeNull();
    expect(RpcExceptionFilter.toServiceError("texte")).toBeNull();
  });
});
