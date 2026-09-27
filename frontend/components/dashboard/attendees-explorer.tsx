"use client";

// Participants d'un événement (organisateur) : recherche par nom, email ou
// référence, filtre par statut d'entrée et type de billet, tri et affichage
// progressif. La liste complète est chargée une fois (GET /events/:id/attendees),
// le filtrage est donc instantané, y compris le jour J à l'entrée.

import { useMemo, useState } from "react";
import { AttendeeRow } from "@/components/dashboard/attendee-row";
import { FilterPills } from "@/components/admin/filter-pills";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { SearchField } from "@/components/ui/search-field";
import type { ApiTicket } from "@/lib/api/tickets";
import { matchesSearch } from "@/lib/format/search";
import { apiTicketToAttendee, type Attendee } from "@/lib/mappers/event-detail-mappers";

const PAGE_SIZE = 50;

type StatusFilter = "all" | Attendee["status"];
type SortOrder = "name" | "recent" | "oldest";

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "name", label: "Nom (A → Z)" },
  { id: "recent", label: "Achat le plus récent" },
  { id: "oldest", label: "Achat le plus ancien" },
];

export function AttendeesExplorer({ tickets }: { tickets: ApiTicket[] }) {
  const attendees = useMemo(() => tickets.map(apiTicketToAttendee), [tickets]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortOrder>("name");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categories = useMemo(
    () => [...new Set(attendees.map((attendee) => attendee.category))].sort((a, b) => a.localeCompare(b, "fr")),
    [attendees],
  );

  // Compteurs par statut, calculés après recherche et type de billet.
  const beforeStatus = useMemo(() => {
    return attendees.filter(
      (attendee) =>
        (!category || attendee.category === category) &&
        matchesSearch(search, attendee.name, attendee.email, attendee.reference),
    );
  }, [attendees, search, category]);

  const filtered = useMemo(() => {
    const list = status === "all" ? beforeStatus : beforeStatus.filter((attendee) => attendee.status === status);
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "fr");
      const diff = new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime();
      return sort === "recent" ? -diff : diff;
    });
  }, [beforeStatus, status, sort]);

  const count = (value: Attendee["status"]) => beforeStatus.filter((attendee) => attendee.status === value).length;
  const statusOptions = [
    { id: "all", label: "Tous", count: beforeStatus.length },
    { id: "pending", label: "À scanner", count: count("pending") },
    { id: "used", label: "Entrés", count: count("used") },
    { id: "cancelled", label: "Annulés", count: count("cancelled") },
  ];

  const hasFilters = search.trim() !== "" || status !== "all" || category !== "";

  function reset() {
    setSearch("");
    setStatus("all");
    setCategory("");
    setVisible(PAGE_SIZE);
  }

  if (attendees.length === 0) {
    return (
      <p className="rounded-2xl border border-hairline-1 bg-card px-5 py-8 text-center text-sm text-ink-5">
        Aucun participant pour cet événement.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="Nom, email ou référence du billet…"
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          {categories.length > 1 ? (
            <FilterMenu label="Type de billet" value={category} active={category !== ""} align="right">
              {(close) => (
                <div role="menu">
                  <FilterOption selected={category === ""} onSelect={() => { setCategory(""); close(); }}>
                    Tous les billets
                  </FilterOption>
                  {categories.map((name) => (
                    <FilterOption key={name} selected={category === name} onSelect={() => { setCategory(name); close(); }}>
                      {name}
                    </FilterOption>
                  ))}
                </div>
              )}
            </FilterMenu>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-ink-5">
            <span className="sr-only">Trier par</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              className="h-10 rounded-full border border-hairline-3 bg-card px-4 text-sm font-medium text-ink-2 focus:border-blue-500 focus:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          options={statusOptions}
          active={status}
          onChange={(id) => {
            setStatus(id as StatusFilter);
            setVisible(PAGE_SIZE);
          }}
        />
        {hasFilters ? (
          <button type="button" onClick={reset} className="text-sm font-medium text-link hover:text-link-hover">
            Réinitialiser
          </button>
        ) : null}
      </div>

      <p className="text-sm text-ink-5" role="status">
        {filtered.length} participant{filtered.length > 1 ? "s" : ""}
        {filtered.length !== attendees.length ? ` sur ${attendees.length}` : ""}
      </p>

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {filtered.length > 0 ? (
          filtered.slice(0, visible).map((attendee) => <AttendeeRow key={attendee.id} attendee={attendee} />)
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="text-sm text-ink-5">Aucun participant ne correspond à ces critères.</p>
            <button type="button" onClick={reset} className="text-sm font-medium text-link hover:text-link-hover">
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {filtered.length > visible ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((current) => current + PAGE_SIZE)}
            className="rounded-full border border-hairline-3 px-6 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
          >
            Afficher plus ({filtered.length - visible} restants)
          </button>
        </div>
      ) : null}
    </div>
  );
}
