"use client";

// Tous les événements : recherche, filtres et tri côté serveur (GET /admin/events), « Afficher plus ».

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { AdminEventRow } from "@/components/admin/admin-event-row";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { SearchField } from "@/components/ui/search-field";
import { getAdminEvents, type AdminEventSort, type ApiAdminEvent } from "@/lib/api/admin";
import { listAllCategories, type ApiCategory } from "@/lib/api/categories";
import { ApiError } from "@/lib/api/http-error";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";
import { filterSelectClass } from "@/components/ui/field";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { t, msg } from "@/lib/i18n/translate";

const PAGE_SIZE = 50;

const eventStatusFilters: { id: string; label: string }[] = [
  { id: "all", label: msg("Tous") },
  { id: "PUBLISHED", label: msg("Publiés") },
  { id: "PENDING_VALIDATION", label: msg("En validation") },
  { id: "DRAFT", label: msg("Brouillons") },
  { id: "SUSPENDED", label: msg("Suspendus") },
  { id: "POSTPONED", label: msg("Reportés") },
  { id: "CANCELLED", label: msg("Annulés") },
  { id: "TERMINATED", label: msg("Terminés") },
  { id: "ARCHIVED", label: msg("Archivés") },
];

const whenOptions: { id: "" | "upcoming" | "past"; label: string }[] = [
  { id: "", label: msg("Toutes les dates") },
  { id: "upcoming", label: msg("À venir ou en cours") },
  { id: "past", label: msg("Passés") },
];

const sortOptions: { id: AdminEventSort; label: string }[] = [
  { id: "created_desc", label: msg("Création la plus récente") },
  { id: "start_asc", label: msg("Date la plus proche") },
  { id: "start_desc", label: msg("Date la plus lointaine") },
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
        .catch((err) => setError(err instanceof ApiError ? err.message : t("Impossible de charger les événements.")));
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
      setError(err instanceof ApiError ? err.message : t("Impossible de charger la suite."));
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
          placeholder={t("Titre, lieu, ville ou organisateur…")}
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu label={t("Catégorie")} value={categoryLabel} active={category !== ""} align="right">
            {(close) => (
              <div role="menu">
                <FilterOption selected={category === ""} onSelect={() => { setCategory(""); close(); }}>{t("Toutes les catégories")}</FilterOption>
                {categories.map((option) => (
                  <FilterOption
                    key={option.id}
                    selected={category === option.code}
                    onSelect={() => { setCategory(option.code); close(); }}
                  >
                    {t(option.label)}
                    {option.is_active ? "" : t(" (désactivée)")}
                  </FilterOption>
                ))}
              </div>
            )}
          </FilterMenu>
          <FilterMenu
            label={t("Période")}
            value={whenOptions.find((option) => option.id === when)?.label}
            active={when !== ""}
            align="right"
          >
            {(close) => (
              <div role="menu">
                {whenOptions.map((option) => (
                  <FilterOption key={option.id} selected={when === option.id} onSelect={() => { setWhen(option.id); close(); }}>
                    {t(option.label)}
                  </FilterOption>
                ))}
              </div>
            )}
          </FilterMenu>
          <label className="flex items-center gap-2 text-sm text-ink-5">
            <span className="sr-only">{t("Trier par")}</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as AdminEventSort)}
              className={filterSelectClass}
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills options={eventStatusFilters} active={status} onChange={setStatus} />
        {hasFilters ? (
          <button type="button" onClick={reset} className="text-sm font-medium text-link hover:text-link-hover">{t("Réinitialiser")}</button>
        ) : null}
      </div>

      {error ? (
        <Alert>{error}</Alert>
      ) : null}

      {events ? (
        <p className="text-sm text-ink-5" role="status">{(total > 1 ? t("{total} événements", { total }) : t("{total} événement", { total }))}</p>
      ) : null}

      <div className={cardClass("overflow-hidden")}>
        {events === null ? (
          <MutedMessage variant="list" />
        ) : events.length > 0 ? (
          events.map((event) => <AdminEventRow key={event.id} event={event} />)
        ) : (
          <MutedMessage variant="list">{t("Aucun événement ne correspond à ces critères.")}</MutedMessage>
        )}
      </div>

      {events && events.length < total ? (
        <LoadMoreButton onClick={loadMore} loading={loadingMore} remaining={total - events.length} />
      ) : null}
    </div>
  );
}
