import { RpcException } from "@nestjs/microservices";
import { User, UserRole } from "../user/user.entity";

/**
 * Bug corrigé (faille de contrôle d'accès) : rien n'empêchait un ADMIN
 * normal de suspendre, débloquer, réactiver, réinitialiser la 2FA ou
 * changer le rôle de n'importe quel autre ADMIN — voire de se promouvoir
 * lui-même. Seul un SUPER_ADMIN peut désormais agir sur un compte
 * ADMIN/SUPER_ADMIN. Toute action sur son propre compte est aussi bloquée :
 * un SUPER_ADMIN qui se rétrograderait ou se suspendrait lui-même se
 * couperait l'accès sans recours possible.
 *
 * Partagé entre AuthService (suspend/unsuspend/change-role/unlock/activate)
 * et TwoFactorService (reset-2FA par un admin) — même règle, deux services.
 */
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
