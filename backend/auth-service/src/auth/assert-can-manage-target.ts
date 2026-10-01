import { RpcException } from "@nestjs/microservices";
import { User, UserRole } from "../user/user.entity";

/** Seul un SUPER_ADMIN agit sur un compte admin, et personne sur son propre compte (évite de se couper l'accès). */
export function assertCanManageTarget(
  target: User,
  actorId: string,
  actorRole: UserRole,
): void {
  if (target.id === actorId) {
    throw new RpcException({
      statusCode: 403,
      message: "Action impossible sur son propre compte",
    });
  }
  const targetIsElevated =
    target.role === UserRole.ADMIN || target.role === UserRole.SUPER_ADMIN;
  if (targetIsElevated && actorRole !== UserRole.SUPER_ADMIN) {
    throw new RpcException({
      statusCode: 403,
      message: "Seul un super-admin peut gérer un compte admin",
    });
  }
}
