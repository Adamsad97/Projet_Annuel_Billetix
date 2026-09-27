"use client";

// Comptes de la plateforme : recherche (nom complet, email), rôle, statut et
// tri appliqués par le serveur (GET /admin/users), pagination « Afficher plus ».

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { UserRow } from "@/components/admin/user-row";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { SearchField } from "@/components/ui/search-field";
import {
  searchUsers,
  suspendUser,
  unsuspendUser,
  type AdminUserSort,
  type AdminUserStatusFilter,
  type ApiAdminUser,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

const PAGE_SIZE = 50;

const roleFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "BUYER", label: "Acheteurs" },
  { id: "ORGANIZER", label: "Organisateurs" },
  { id: "ADMIN", label: "Admins" },
  { id: "AGENT", label: "Agents" },
  { id: "SUPER_ADMIN", label: "Super-admins" },
];

const statusFilters: { id: "" | AdminUserStatusFilter; label: string }[] = [
  { id: "", label: "Tous les statuts" },
  { id: "active", label: "Actifs" },
  { id: "suspended", label: "Suspendus" },
  { id: "locked", label: "Verrouillés (échecs de connexion)" },
  { id: "unverified", label: "Email non vérifié" },
];

const sortOptions: { id: AdminUserSort; label: string }[] = [
  { id: "recent", label: "Inscription la plus récente" },
  { id: "oldest", label: "Inscription la plus ancienne" },
  { id: "name", label: "Nom (A → Z)" },
];

export function UsersExplorer() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState<"" | AdminUserStatusFilter>("");
  const [sort, setSort] = useState<AdminUserSort>("recent");
  const [users, setUsers] = useState<ApiAdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  const query = (offset: number, limit: number) =>
    searchUsers({
      q: search.trim() || undefined,
      role: role === "all" ? undefined : role,
      status: status || undefined,
      sort,
      limit,
      offset,
    });

  function showPage(offset: number, limit: number, append: boolean) {
    return query(offset, limit)
      .then((result) => {
        setUsers((current) => (append && current ? [...current, ...result.data] : result.data));
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les utilisateurs."));
  }

  // Après une action : recharge en gardant le nombre de comptes déjà affichés.
  function load() {
    showPage(0, Math.max(PAGE_SIZE, users?.length ?? 0), false);
  }

  // Recherche différée (300ms) pour éviter une requête à chaque frappe.
  useEffect(() => {
    const timeout = setTimeout(() => showPage(0, PAGE_SIZE, false), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, status, sort]);

  async function loadMore() {
    if (!users) return;
    setLoadingMore(true);
    await showPage(users.length, PAGE_SIZE, true);
    setLoadingMore(false);
  }

  const hasFilters = search.trim() !== "" || role !== "all" || status !== "";
  function reset() {
    setSearch("");
    setRole("all");
    setStatus("");
  }

  function handleSuspend(user: ApiAdminUser) {
    setDialog({
      title: `Suspendre ${user.first_name} ${user.last_name} ?`,
      message: "Le compte ne pourra plus se connecter tant que la suspension n'est pas levée. Le titulaire est notifié par email.",
      confirmLabel: "Suspendre",
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: "Motif de la suspension…",
      onConfirm: async (reason) => {
        setBusyId(user.id);
        try {
          await suspendUser(user.id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de suspendre ce compte.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function handleUnsuspend(user: ApiAdminUser) {
    setDialog({
      title: `Réactiver ${user.first_name} ${user.last_name} ?`,
      message: "Le compte retrouve immédiatement l'accès à la plateforme.",
      confirmLabel: "Réactiver",
      onConfirm: async () => {
        setBusyId(user.id);
        try {
          await unsuspendUser(user.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Impossible de réactiver ce compte.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField value={search} onChange={setSearch} placeholder="Nom, prénom ou email…" className="w-full sm:max-w-sm" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu
            label="Statut"
            value={statusFilters.find((option) => option.id === status)?.label}
            active={status !== ""}
            align="right"
          >
            {(close) => (
              <div role="menu">
                {statusFilters.map((option) => (
                  <FilterOption
                    key={option.id}
                    selected={status === option.id}
                    onSelect={() => {
                      setStatus(option.id);
                      close();
                    }}
                  >
                    {option.label}
                  </FilterOption>
                ))}
              </div>
            )}
          </FilterMenu>
          <label className="flex items-center gap-2 text-sm text-ink-5">
            <span className="sr-only">Trier par</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as AdminUserSort)}
              className="h-10 rounded-full border border-hairline-3 bg-card px-4 text-sm font-medium text-ink-2 focus:border-blue-500 focus:outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills options={roleFilters} active={role} onChange={setRole} />
        {hasFilters ? (
          <button type="button" onClick={reset} className="text-sm font-medium text-link hover:text-link-hover">
            Réinitialiser
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      {users ? (
        <p className="text-sm text-ink-5" role="status">
          {total} compte{total > 1 ? "s" : ""}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {users === null ? (
          <p className="px-5 py-8 text-center text-sm text-ink-5">Chargement…</p>
        ) : users.length > 0 ? (
          users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              busy={busyId === user.id}
              onSuspend={() => handleSuspend(user)}
              onUnsuspend={() => handleUnsuspend(user)}
            />
          ))
        ) : (
          <p className="px-5 py-8 text-center text-sm text-ink-5">Aucun utilisateur ne correspond à ces critères.</p>
        )}
      </div>

      {users && users.length < total ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-hairline-3 px-6 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:opacity-50"
          >
            {loadingMore ? "Chargement…" : `Afficher plus (${total - users.length} restants)`}
          </button>
        </div>
      ) : null}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
