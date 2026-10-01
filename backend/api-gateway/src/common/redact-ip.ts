import { JwtPayload } from "./decorators/current-user.decorator";

/** RGPD : l'IP n'est renvoyée qu'au super admin ; retire récursivement tout champ ip_address. */
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
