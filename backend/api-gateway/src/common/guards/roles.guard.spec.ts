import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  function makeContext(user: { role?: string } | undefined): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it("laisse passer une route sans restriction de rôle déclarée", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ role: "BUYER" }))).toBe(true);
  });

  it("laisse passer un utilisateur dont le rôle est autorisé", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN", "ORGANIZER"]);
    expect(guard.canActivate(makeContext({ role: "ORGANIZER" }))).toBe(true);
  });

  it("bloque un utilisateur dont le rôle n'est pas autorisé", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"]);
    expect(() => guard.canActivate(makeContext({ role: "BUYER" }))).toThrow(
      ForbiddenException,
    );
  });

  it("bloque une requête sans utilisateur authentifié quand un rôle est requis", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
