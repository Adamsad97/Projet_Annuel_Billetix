"use client";

// Bug corrigé : page 100% maquette (adminUsers factices) — câblée sur
// GET /admin/users (recherche + filtre rôle côté serveur, comme pour les
// autres explorers admin).

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchInput } from "@/components/admin/search-input";
import { UserRow } from "@/components/admin/user-row";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { searchUsers, suspendUser, unsuspendUser, type ApiAdminUser } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

const roleFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "BUYER", label: "Acheteurs" },
  { id: "ORGANIZER", label: "Organisateurs" },
  { id: "ADMIN", label: "Admins" },
  { id: "AGENT", label: "Agents" },
];

export function UsersExplorer() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [users, setUsers] = useState<ApiAdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  function load() {
    searchUsers({ q: search || undefined, role: role === "all" ? undefined : role, limit: 50 })
      .then((result) => {
        setUsers(result.data);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les utilisateurs."));
  }

  // Recherche différée (300ms) pour éviter une requête à chaque frappe.
  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role]);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterPills options={roleFilters} active={role} onChange={setRole} />
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un nom ou un email…" />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
        {users === null ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Chargement…</p>
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
          <p className="px-5 py-8 text-center text-sm text-gray-500">Aucun utilisateur ne correspond à cette recherche.</p>
        )}
      </div>

      {users && users.length > 0 ? (
        <p className="text-center text-xs text-gray-600">
          {users.length} sur {total} compte{total > 1 ? "s" : ""}
        </p>
      ) : null}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
