"use client";

// CDC — accueil physique : un organisateur venu directement au bureau peut
// demander à un admin de créer son événement pour lui plutôt que de passer
// par le formulaire en ligne (backend/api-gateway/src/admin/admin.controller.ts,
// POST /admin/events). Gère aussi les deux cas où l'organisateur n'est pas
// trouvable par email : compte existant mais jamais organisateur (upgrade
// de rôle), et aucun compte du tout (création à la volée).

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { CreateEventForm } from "@/components/create-event/create-event-form";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { listTicketTierTypes, type ApiTicketTierType } from "@/lib/api/ticket-tier-types";
import { changeUserRole, searchUsers, type ApiAdminUser } from "@/lib/api/admin";
import { registerUser, requestPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http-error";

const roleLabel: Record<ApiAdminUser["role"], string> = {
  BUYER: "Acheteur",
  ORGANIZER: "Organisateur",
  ADMIN: "Admin",
  AGENT: "Agent",
  SUPER_ADMIN: "Super-admin",
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Jamais transmis ni affiché — le compte est créé puis un email de
// définition de mot de passe est immédiatement envoyé (cf. handleCreateAccount).
function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export default function AdminCreateEventForOrganizerPage() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [tierTypes, setTierTypes] = useState<ApiTicketTierType[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiAdminUser[] | undefined>(undefined);
  const [selected, setSelected] = useState<ApiAdminUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
    listTicketTierTypes().then(setTierTypes).catch(() => setTierTypes([]));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowCreateAccount(false);
    if (!query.trim()) {
      setResults(undefined);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(() => {
      // Pas de filtre par rôle : un compte "Acheteur" jamais encore
      // organisateur doit aussi remonter, pour pouvoir le faire passer
      // organisateur ci-dessous plutôt que de croire qu'il n'existe pas.
      searchUsers({ q: query.trim(), limit: 10 })
        .then((result) => {
          if (!cancelled) setResults(result.data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : "Recherche impossible.");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  async function handlePromoteAndSelect(candidate: ApiAdminUser) {
    setBusyId(candidate.id);
    setError(null);
    try {
      const updated = await changeUserRole(candidate.id, "ORGANIZER");
      setSelected(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de passer ce compte organisateur.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreatingAccount(true);
    try {
      const session = await registerUser({
        email: query.trim(),
        password: randomPassword(),
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        role: "ORGANIZER",
      });
      // Le mot de passe généré n'est connu de personne — l'organisateur
      // reçoit tout de suite un lien pour définir le sien (même email que
      // "mot de passe oublié"), en plus de l'email de bienvenue déjà envoyé
      // par l'inscription.
      await requestPasswordReset(session.user.email).catch(() => undefined);
      setSelected({
        id: session.user.id,
        email: session.user.email,
        first_name: session.user.first_name,
        last_name: session.user.last_name,
        phone: session.user.phone,
        role: "ORGANIZER",
        is_email_verified: session.user.is_email_verified,
        two_factor_enabled: session.user.two_factor_enabled,
        // Compte tout juste créé : valeurs neutres pour les champs que
        // AuthUser ne type pas (existent côté API mais inutiles au flux
        // d'inscription pré-connexion).
        failed_login_attempts: 0,
        locked_until: null,
        is_active: true,
        is_suspended: false,
        suspension_reason: null,
        suspended_at: null,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer ce compte.");
    } finally {
      setCreatingAccount(false);
    }
  }

  return (
    <AdminShell active="/admin/evenements">
      <Link
        href="/admin/evenements"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
      >
        ← Événements
      </Link>

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">Créer un événement pour un organisateur</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pour un organisateur venu directement au bureau — l&apos;événement sera créé sous son compte.
        </p>
      </div>

      {!selected ? (
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Organisateur (nom ou email) *</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ex: marie.kone@email.com"
              autoFocus
              className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
            />
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          {searching ? (
            <p className="text-center text-sm text-gray-500">Recherche…</p>
          ) : results !== undefined ? (
            <>
              {results.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
                  {results.map((account) => {
                    const selectable =
                      !account.is_suspended &&
                      account.role !== "ADMIN" &&
                      account.role !== "AGENT" &&
                      account.role !== "SUPER_ADMIN";
                    const needsPromotion = account.role === "BUYER";
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => (selectable ? (needsPromotion ? handlePromoteAndSelect(account) : setSelected(account)) : undefined)}
                        disabled={!selectable || busyId === account.id}
                        className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span>
                          <span className="block text-sm font-medium text-white">
                            {account.first_name} {account.last_name}
                          </span>
                          <span className="block text-xs text-gray-500">{account.email} · {roleLabel[account.role]}</span>
                        </span>
                        {account.is_suspended ? (
                          <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">
                            Suspendu
                          </span>
                        ) : busyId === account.id ? (
                          <span className="shrink-0 text-xs text-gray-500">…</span>
                        ) : needsPromotion ? (
                          <span className="shrink-0 text-xs font-medium text-violet-400">Passer organisateur →</span>
                        ) : selectable ? (
                          <span className="shrink-0 text-sm text-violet-400">Choisir →</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500">Aucun compte trouvé pour cette recherche.</p>
              )}

              {isValidEmail(query.trim()) ? (
                showCreateAccount ? (
                  <form
                    onSubmit={handleCreateAccount}
                    className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#12101c] p-4"
                  >
                    <p className="text-sm font-medium text-white">
                      Nouveau compte organisateur — {query.trim()}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        required
                        value={newFirstName}
                        onChange={(event) => setNewFirstName(event.target.value)}
                        placeholder="Prénom"
                        className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                      />
                      <input
                        required
                        value={newLastName}
                        onChange={(event) => setNewLastName(event.target.value)}
                        placeholder="Nom"
                        className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                    <input
                      value={newPhone}
                      onChange={(event) => setNewPhone(event.target.value)}
                      placeholder="Téléphone (optionnel)"
                      className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500">
                      Un email lui sera envoyé pour qu&apos;il définisse son mot de passe.
                    </p>
                    <button
                      type="submit"
                      disabled={creatingAccount}
                      className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {creatingAccount ? "Création…" : "Créer le compte et continuer →"}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateAccount(true)}
                    className="rounded-xl border border-dashed border-white/10 py-2.5 text-sm font-medium text-violet-400 transition-colors hover:border-white/20 hover:text-violet-300"
                  >
                    + Nouveau compte organisateur pour « {query.trim()} »
                  </button>
                )
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mx-auto mb-6 flex max-w-2xl items-center justify-between rounded-2xl border border-violet-500/20 bg-violet-500/5 px-5 py-3">
            <p className="text-sm text-violet-200">
              Pour <span className="font-semibold">{selected.first_name} {selected.last_name}</span> ({selected.email})
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm font-medium text-gray-400 hover:text-white"
            >
              Changer
            </button>
          </div>

          <CreateEventForm categories={categories} tierTypes={tierTypes} adminOrganizerId={selected.id} />
        </>
      )}
    </AdminShell>
  );
}
