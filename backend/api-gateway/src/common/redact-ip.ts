import { JwtPayload } from "./decorators/current-user.decorator";

/**
 * L'adresse IP est une donnée personnelle (RGPD, minimisation) : elle reste
 * enregistrée pour les enquêtes, mais n'est renvoyée qu'au super admin, qui
 * traite les litiges et incidents de sécurité. Les autres admins voient
 * l'appareil, pas l'IP. Retire récursivement tout champ `ip_address`.
 */
export function redactIpUnlessSuperAdmin<T>(user: JwtPayload | undefined, value: T): T {
  if (user?.role === "SUPER_ADMIN") return value;
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "ip_address")
        .map(([key, entry]) => [key, strip(entry)]),
    );
  }
  return value;
}
