"use client";

// CDC — accueil physique : un organisateur venu directement au bureau peut
// demander à un admin de créer son événement pour lui plutôt que de passer
// par le formulaire en ligne (backend/api-gateway/src/admin/admin.controller.ts,
// POST /admin/events).

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { CreateEventForm } from "@/components/create-event/create-event-form";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import { listTicketTierTypes, type ApiTicketTierType } from "@/lib/api/ticket-tier-types";
import { searchUsers, type ApiAdminUser } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

export default function AdminCreateEventForOrganizerPage() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [tierTypes, setTierTypes] = useState<ApiTicketTierType[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiAdminUser[] | undefined>(undefined);
  const [selected, setSelected] = useState<ApiAdminUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
    listTicketTierTypes().then(setTierTypes).catch(() => setTierTypes([]));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(undefined);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(() => {
      searchUsers({ q: query.trim(), role: "ORGANIZER", limit: 10 })
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
            results.length === 0 ? (
              <p className="text-center text-sm text-gray-500">
                Aucun organisateur trouvé — vérifie l&apos;orthographe ou qu&apos;il a bien un compte.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
                {results.map((organizer) => (
                  <button
                    key={organizer.id}
                    type="button"
                    onClick={() => setSelected(organizer)}
                    disabled={organizer.is_suspended}
                    className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>
                      <span className="block text-sm font-medium text-white">
                        {organizer.first_name} {organizer.last_name}
                      </span>
                      <span className="block text-xs text-gray-500">{organizer.email}</span>
                    </span>
                    {organizer.is_suspended ? (
                      <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">
                        Suspendu
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm text-violet-400">Choisir →</span>
                    )}
                  </button>
                ))}
              </div>
            )
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
