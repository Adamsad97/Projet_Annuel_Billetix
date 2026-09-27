"use client";

// Tous les événements de la plateforme : recherche (titre, lieu, ville ou
// organisateur), statut, catégorie, période et tri appliqués par le serveur
// (GET /admin/events), pagination « Afficher plus ».

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { AdminEventRow } from "@/components/admin/admin-event-row";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { SearchField } from "@/components/ui/search-field";
import { getAdminEvents, type AdminEventSort, type ApiAdminEvent } from "@/lib/api/admin";
import { listAllCategories, type ApiCategory } from "@/lib/api/categories";
import { ApiError } from "@/lib/api/http-error";

const PAGE_SIZE = 50;

const eventStatusFilters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "PUBLISHED", label: "Publiés" },
  { id: "PENDING_VALIDATION", label: "En validation" },
  { id: "DRAFT", label: "Brouillons" },
  { id: "SUSPENDED", label: "Suspendus" },
  { id: "CANCELLED", label: "Annulés" },
  { id: "TERMINATED", label: "Terminés" },
  { id: "ARCHIVED", label: "Archivés" },
];

const whenOptions: { id: "" | "upcoming" | "past"; label: string }[] = [
  { id: "", label: "Toutes les dates" },
  { id: "upcoming", label: "À venir ou en cours" },
  { id: "past", label: "Passés" },
];

const sortOptions: { id: AdminEventSort; label: string }[] = [
  { id: "created_desc", label: "Création la plus récente" },
  { id: "start_asc", label: "Date la plus proche" },
  { id: "start_desc", label: "Date la plus lointaine" },
  { id: "title", label: "Titre (A → Z)" },
];

export function EventsExplorer() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("");
  const [when, setWhen] = useState<"" | "upcoming" | "past">("");
  const [sort, setSort] = useState<AdminEventSort>("created_desc");
  const [categories, setCategories] = useState<ApiCategory[]>([]);

  const [events, setEvents] = useState<ApiAdminEvent[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAllCategories()
      .then((list) => setCategories([...list].sort((a, b) => a.display_order - b.display_order)))
      .catch(() => undefined);
  }, []);

  const query = (offset: number) =>
    getAdminEvents({
      status: status === "all" ? undefined : status,
      q: search.trim() || undefined,
      category: category || undefined,
      when: when || undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    });

  // Recherche différée (300ms) pour éviter une requête à chaque frappe.
  useEffect(() => {
    const timeout = setTimeout(() => {
      query(0)
        .then((result) => {
          setEvents(result.data);
          setTotal(result.total);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les événements."));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, category, when, sort]);

  async function loadMore() {
    if (!events) return;
    setLoadingMore(true);
    try {
      const result = await query(events.length);
      setEvents([...events, ...result.data]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger la suite.");
    } finally {
      setLoadingMore(false);
    }
  }

  const categoryLabel = categories.find((c) => c.code === category)?.label ?? category;
  const hasFilters = search.trim() !== "" || status !== "all" || category !== "" || when !== "";

  function reset() {
    setSearch("");
    setStatus("all");
    setCategory("");
    setWhen("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Titre, lieu, ville ou organisateur…"
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu label="Catégorie" value={categoryLabel} active={category !== ""} align="right">
            {(close) => (
              <div role="menu">
                <FilterOption selected={category === ""} onSelect={() => { setCategory(""); close(); }}>
                  Toutes les catégories
                </FilterOption>
                {categories.map((option) => (
                  <FilterOption
                    key={option.id}
                    selected={category === option.code}
                    onSelect={() => { setCategory(option.code); close(); }}
                  >
                    {option.label}
                    {option.is_active ? "" : " (désactivée)"}
                  </FilterOption>
                ))}
              </div>
            )}
          </FilterMenu>
          <FilterMenu
            label="Période"
            value={whenOptions.find((option) => option.id === when)?.label}
            active={when !== ""}
            align="right"
          >
            {(close) => (
              <div role="menu">
                {whenOptions.map((option) => (
                  <FilterOption key={option.id} selected={when === option.id} onSelect={() => { setWhen(option.id); close(); }}>
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
              onChange={(event) => setSort(event.target.value as AdminEventSort)}
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
        <FilterPills options={eventStatusFilters} active={status} onChange={setStatus} />
        {hasFilters ? (
          <button type="button" onClick={reset} className="text-sm font-medium text-link hover:text-link-hover">
            Réinitialiser
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}

      {events ? (
        <p className="text-sm text-ink-5" role="status">
          {total} événement{total > 1 ? "s" : ""}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {events === null ? (
          <p className="px-5 py-8 text-center text-sm text-ink-5">Chargement…</p>
        ) : events.length > 0 ? (
          events.map((event) => <AdminEventRow key={event.id} event={event} />)
        ) : (
          <p className="px-5 py-8 text-center text-sm text-ink-5">Aucun événement ne correspond à ces critères.</p>
        )}
      </div>

      {events && events.length < total ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-hairline-3 px-6 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:opacity-50"
          >
            {loadingMore ? "Chargement…" : `Afficher plus (${total - events.length} restants)`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
