import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

// SUPER_ADMIN hérite de tout ce qu'un ADMIN peut faire — évite de devoir
// ajouter "SUPER_ADMIN" à chaque @Roles("ADMIN") existant (10+ endroits).
// Les actions réservées au SEUL super-admin (gérer un autre admin) sont
// tranchées plus finement côté auth-service (AuthService.
// assertCanManageTarget), pas ici : ce guard ne connaît que le rôle de
// l'appelant, jamais celui de la cible d'une action.
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
