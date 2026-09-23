import Link from "next/link";
import type { ApiAdminUser, ApiUserRole } from "@/lib/api/admin";

const roleStyles: Record<ApiUserRole, string> = {
  BUYER: "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30",
  ORGANIZER: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  ADMIN: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
  AGENT: "bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/30",
  SUPER_ADMIN: "bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30",
};

const roleLabels: Record<ApiUserRole, string> = {
  BUYER: "Acheteur",
  ORGANIZER: "Organisateur",
  ADMIN: "Admin",
  AGENT: "Agent",
  SUPER_ADMIN: "Super-admin",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export function UserRow({
  user,
  busy,
  onSuspend,
  onUnsuspend,
}: {
  user: ApiAdminUser;
  busy: boolean;
  onSuspend: () => void;
  onUnsuspend: () => void;
}) {
  const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-amber-400 text-sm font-bold text-white">
          {initials}
        </div>
        <div>
          <p className="text-sm font-bold text-white">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-gray-500">
            {user.email} · Membre depuis {dateFormatter.format(new Date(user.created_at))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleStyles[user.role]}`}>
          {roleLabels[user.role]}
        </span>

        {user.is_suspended ? (
          <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30">
            Suspendu
          </span>
        ) : null}
        {!user.is_email_verified ? (
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-white/10">
            Email non vérifié
          </span>
        ) : null}

        <Link
          href={`/admin/utilisateurs/${user.id}`}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
        >
          ● Voir
        </Link>
        {user.is_suspended ? (
          <button
            type="button"
            disabled={busy}
            onClick={onUnsuspend}
            className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {busy ? "…" : "Réactiver"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onSuspend}
            className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/30 transition-colors hover:bg-red-500/25 disabled:opacity-50"
          >
            {busy ? "…" : "Suspendre"}
          </button>
        )}
      </div>
    </div>
  );
}
