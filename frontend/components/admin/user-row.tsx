"use client";

import Link from "next/link";
import type { ApiAdminUser, ApiUserRole } from "@/lib/api/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { t, msg } from "@/lib/i18n/translate";
import { localizedDate } from "@/lib/i18n/intl";

const roleStyles: Record<ApiUserRole, string> = {
  BUYER: "bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/30",
  ORGANIZER: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  ADMIN: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  AGENT: "bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/30",
  SUPER_ADMIN: "bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/30",
};

const roleLabels: Record<ApiUserRole, string> = {
  BUYER: msg("Acheteur"),
  ORGANIZER: msg("Organisateur"),
  ADMIN: msg("Admin"),
  AGENT: msg("Agent"),
  SUPER_ADMIN: msg("Super-admin"),
};

const dateFormatter = localizedDate({ month: "long", year: "numeric" });

export function UserRow({
  user,
  isSelf,
  canManage,
  busy,
  onSuspend,
  onUnsuspend,
}: {
  user: ApiAdminUser;
  /** Compte de la personne connectée : aucune action, lien vers son profil. */
  isSelf: boolean;
  /** Même règle que le serveur (assertCanManageTarget) : seul un super admin gère un admin. */
  canManage: boolean;
  busy: boolean;
  onSuspend: () => void;
  onUnsuspend: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline-1 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <Avatar firstName={user.first_name} lastName={user.last_name} />
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-ink-1">
            {user.first_name} {user.last_name}
            {isSelf ? (
              <span className="rounded-full bg-hairline-1 px-2 py-0.5 text-xs font-medium text-ink-4 ring-1 ring-inset ring-hairline-2">{t("Vous")}</span>
            ) : null}
          </p>
          <p className="text-xs text-ink-5">{t("{email} · Membre depuis {value}", { email: user.email, value: dateFormatter.format(new Date(user.created_at)) })}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={roleStyles[user.role]}>
          {t(roleLabels[user.role])}
        </Badge>

        {user.is_suspended ? (
          <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">{t("Suspendu")}</span>
        ) : null}
        {!user.is_email_verified ? (
          <span className="rounded-full bg-hairline-1 px-2.5 py-0.5 text-xs font-medium text-ink-4 ring-1 ring-inset ring-hairline-2">{t("Email non vérifié")}</span>
        ) : null}

        <Link
          href={isSelf ? "/profil" : `/admin/utilisateurs/${user.id}`}
          className="rounded-lg bg-hairline-1 px-3 py-1.5 text-xs font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
        >
          {isSelf ? t("Mon profil") : t("Voir")}
        </Link>
        {!canManage ? null : user.is_suspended ? (
          <button
            type="button"
            disabled={busy}
            onClick={onUnsuspend}
            className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {busy ? "…" : t("Réactiver")}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onSuspend}
            className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
          >
            {busy ? "…" : t("Suspendre")}
          </button>
        )}
      </div>
    </div>
  );
}
