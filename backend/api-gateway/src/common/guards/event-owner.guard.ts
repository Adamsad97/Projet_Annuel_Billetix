import {
  applyDecorators,
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ClientProxy } from "@nestjs/microservices";
import { isUUID } from "class-validator";
import { firstValueFrom } from "rxjs";
import type { JwtPayload } from "../decorators/current-user.decorator";

const EVENT_OWNER_KEY = "eventOwner";

/** Où lire l'identifiant de l'événement dans la requête. */
export type EventIdSource = { param: string } | { body: string };

/** Réserve la route à l'organisateur de l'événement visé, ex. @EventOwner({ param: "eventId" }). */
export function EventOwner(source: EventIdSource) {
  return applyDecorators(SetMetadata(EVENT_OWNER_KEY, source), UseGuards(EventOwnerGuard));
}

@Injectable()
export class EventOwnerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject("EVENT_SERVICE") private readonly eventClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const source = this.reflector.get<EventIdSource | undefined>(EVENT_OWNER_KEY, context.getHandler());
    if (!source) return true;

    const request = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      params: Record<string, string>;
      body?: Record<string, unknown>;
    }>();
    if (request.user?.role !== "ORGANIZER") return true;

    const eventId = "param" in source ? request.params[source.param] : request.body?.[source.body];
    if (typeof eventId !== "string" || !isUUID(eventId)) {
      throw new BadRequestException("Identifiant d'événement invalide.");
    }

    const event = await firstValueFrom(this.eventClient.send<{ organizer_id: string } | null>("event.get", { id: eventId })).catch(
      () => null,
    );
    if (!event) throw new NotFoundException("Événement introuvable.");
    if (event.organizer_id !== request.user.sub) {
      throw new ForbiddenException("Vous n'êtes pas l'organisateur de cet événement.");
    }
    return true;
  }
}
