import { CallHandler, ExecutionContext, GatewayTimeoutException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, of, throwError, timer } from "rxjs";
import { map } from "rxjs/operators";
import { TimeoutInterceptor } from "./timeout.interceptor";

const context = { getHandler: () => undefined, getClass: () => undefined } as unknown as ExecutionContext;

describe("TimeoutInterceptor", () => {
  const build = (routeTimeout?: number) =>
    new TimeoutInterceptor(
      { getAllAndOverride: () => routeTimeout } as unknown as Reflector,
      { get: () => "50" } as unknown as ConfigService,
    );

  it("laisse passer une réponse rapide", async () => {
    const handler: CallHandler = { handle: () => of("ok") };
    await expect(firstValueFrom(build().intercept(context, handler))).resolves.toBe("ok");
  });

  it("répond 504 si le service ne répond pas à temps", async () => {
    const handler: CallHandler = { handle: () => timer(200).pipe(map(() => "trop tard")) };
    await expect(firstValueFrom(build().intercept(context, handler))).rejects.toBeInstanceOf(GatewayTimeoutException);
  });

  it("respecte un délai propre à la route (@RequestTimeout)", async () => {
    const handler: CallHandler = { handle: () => timer(100).pipe(map(() => "ok")) };
    await expect(firstValueFrom(build(500).intercept(context, handler))).resolves.toBe("ok");
  });

  it("ne masque pas les autres erreurs", async () => {
    const handler: CallHandler = { handle: () => throwError(() => new Error("boom")) };
    await expect(firstValueFrom(build().intercept(context, handler))).rejects.toThrow("boom");
  });
});
