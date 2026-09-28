import { BadRequestException, ExecutionContext, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of, throwError } from "rxjs";
import { EventIdSource, EventOwnerGuard } from "./event-owner.guard";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

function context(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("EventOwnerGuard", () => {
  let reflector: { get: jest.Mock };
  let eventClient: { send: jest.Mock };
  let guard: EventOwnerGuard;

  const withSource = (source: EventIdSource | undefined) => reflector.get.mockReturnValue(source);

  beforeEach(() => {
    reflector = { get: jest.fn() };
    eventClient = { send: jest.fn().mockReturnValue(of({ organizer_id: "orga-1" })) };
    guard = new EventOwnerGuard(reflector as unknown as Reflector, eventClient as never);
  });

  it("laisse passer une route sans @EventOwner", async () => {
    withSource(undefined);
    await expect(guard.canActivate(context({ user: { role: "ORGANIZER", sub: "x" }, params: {} }))).resolves.toBe(true);
  });

  it("ne concerne pas les autres rôles (admin, agent)", async () => {
    withSource({ param: "id" });
    await expect(guard.canActivate(context({ user: { role: "ADMIN", sub: "a" }, params: { id: EVENT_ID } }))).resolves.toBe(true);
    expect(eventClient.send).not.toHaveBeenCalled();
  });

  it("autorise l'organisateur de l'événement (identifiant dans l'URL)", async () => {
    withSource({ param: "id" });
    await expect(guard.canActivate(context({ user: { role: "ORGANIZER", sub: "orga-1" }, params: { id: EVENT_ID } }))).resolves.toBe(
      true,
    );
  });

  it("autorise l'organisateur de l'événement (identifiant dans le corps)", async () => {
    withSource({ body: "event_id" });
    await expect(
      guard.canActivate(context({ user: { role: "ORGANIZER", sub: "orga-1" }, params: {}, body: { event_id: EVENT_ID } })),
    ).resolves.toBe(true);
  });

  it("refuse un autre organisateur", async () => {
    withSource({ param: "eventId" });
    await expect(
      guard.canActivate(context({ user: { role: "ORGANIZER", sub: "intrus" }, params: { eventId: EVENT_ID } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuse un identifiant mal formé sans interroger event-service", async () => {
    withSource({ param: "id" });
    await expect(guard.canActivate(context({ user: { role: "ORGANIZER", sub: "orga-1" }, params: { id: "abc" } }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(eventClient.send).not.toHaveBeenCalled();
  });

  it("renvoie 404 si l'événement n'existe pas", async () => {
    withSource({ param: "id" });
    eventClient.send.mockReturnValue(throwError(() => ({ statusCode: 404 })));
    await expect(guard.canActivate(context({ user: { role: "ORGANIZER", sub: "orga-1" }, params: { id: EVENT_ID } }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
