"use client";

// Bug corrigé : page 100% maquette (adminEvents factices) — câblée sur
// GET /admin/events (statut filtré côté serveur, recherche texte côté
// client sur la page déjà chargée, même schéma que UsersExplorer).

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchInput } from "@/components/admin/search-input";
import { AdminEventRow } from "@/components/admin/admin-event-row";
import { getAdminEvents, type ApiAdminEvent } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";

const eventStatusFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "PUBLISHED", label: "Publiés" },
  { id: "PENDING_VALIDATION", label: "En validation" },
  { id: "DRAFT", label: "Brouillons" },
  { id: "ARCHIVED", label: "Archivés" },
  { id: "CANCELLED", label: "Annulés" },
];

export function EventsExplorer() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [events, setEvents] = useState<ApiAdminEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvents(null);
    getAdminEvents(status)
      .then((result) => {
        setEvents(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les événements."));
  }, [status]);

  const query = search.trim().toLowerCase();
  const filtered =
    events?.filter(
      (event) =>
        query === "" ||
        event.title.toLowerCase().includes(query) ||
        event.organizer_name.toLowerCase().includes(query),
    ) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterPills options={eventStatusFilters} active={status} onChange={setStatus} />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un événement ou un organisateur…"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
        {filtered === null ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Chargement…</p>
        ) : filtered.length > 0 ? (
          filtered.map((event) => <AdminEventRow key={event.id} event={event} />)
        ) : (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            Aucun événement ne correspond à cette recherche.
          </p>
        )}
      </div>
    </div>
  );
}
