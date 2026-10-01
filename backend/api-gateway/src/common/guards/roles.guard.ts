import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

// SUPER_ADMIN hérite des droits ADMIN ; les règles sur la cible sont tranchées par auth-service.
const ROLE_IMPLIES: Record<string, string[]> = {
  SUPER_ADMIN: ["ADMIN"],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    const effectiveRoles = [user?.role, ...(ROLE_IMPLIES[user?.role] ?? [])];
    if (!requiredRoles.some((role) => effectiveRoles.includes(role))) {
      throw new ForbiddenException("Accès non autorisé pour ce rôle");
    }
    return true;
  }
}
