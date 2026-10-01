"use client";

// Participants : recherche, filtres et tri instantanés sur la liste chargée une fois.

import { useMemo, useState } from "react";
import { AttendeeRow } from "@/components/dashboard/attendee-row";
import { FilterPills } from "@/components/admin/filter-pills";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { SearchField } from "@/components/ui/search-field";
import type { ApiTicket } from "@/lib/api/tickets";
import { matchesSearch } from "@/lib/format/search";
import { apiTicketToAttendee, type Attendee } from "@/lib/mappers/event-detail-mappers";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { filterSelectClass } from "@/components/ui/field";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { t, msg } from "@/lib/i18n/translate";

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<Attendee["status"], string> = {
  pending: msg("À scanner"),
  used: msg("Entré"),
  cancelled: msg("Annulé"),
};

/** Liste d'émargement au format CSV (séparateur « ; », lisible par Excel en français). */
function downloadCsv(rows: Attendee[], fileName: string) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [
    [t("Nom"), t("Email"), t("Billet"), t("Référence"), t("Statut"), t("Date d'achat")],
    ...rows.map((row) => [row.name, row.email, row.category, row.reference, STATUS_LABELS[row.status], row.purchasedLabel]),
  ].map((cells) => cells.map(escape).join(";"));
  // BOM UTF-8 : accents corrects à l'ouverture dans Excel.
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

type StatusFilter = "all" | Attendee["status"];
type SortOrder = "name" | "recent" | "oldest";

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "name", label: "Nom (A → Z)" },
  { id: "recent", label: msg("Achat le plus récent") },
  { id: "oldest", label: msg("Achat le plus ancien") },
];

export function AttendeesExplorer({ tickets, exportName }: { tickets: ApiTicket[]; exportName: string }) {
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
    { id: "all", label: t("Tous"), count: beforeStatus.length },
    { id: "pending", label: t("À scanner"), count: count("pending") },
    { id: "used", label: t("Entrés"), count: count("used") },
    { id: "cancelled", label: t("Annulés"), count: count("cancelled") },
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
      <p className={cardClass("px-5 py-8 text-center text-sm text-ink-5")}>{t("Aucun participant pour cet événement.")}</p>
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
          placeholder={t("Nom, email ou référence du billet…")}
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          {categories.length > 1 ? (
            <FilterMenu label={t("Type de billet")} value={category} active={category !== ""} align="right">
              {(close) => (
                <div role="menu">
                  <FilterOption selected={category === ""} onSelect={() => { setCategory(""); close(); }}>{t("Tous les billets")}</FilterOption>
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
            <span className="sr-only">{t("Trier par")}</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              className={filterSelectClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(option.label)}
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
          <button type="button" onClick={reset} className="text-sm font-medium text-link hover:text-link-hover">{t("Réinitialiser")}</button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-5" role="status">
          {filtered.length !== attendees.length
            ? t("{count} sur {total}", { count: filtered.length, total: attendees.length })
            : filtered.length > 1
              ? t("{count} participants", { count: filtered.length })
              : t("{count} participant", { count: filtered.length })}
        </p>
        <button
          type="button"
          onClick={() => downloadCsv(filtered, `${exportName}.csv`)}
          disabled={filtered.length === 0}
          className={buttonClass("secondary", "rounded-full px-4 py-2 text-sm disabled:opacity-40")}
        >{t("Exporter la liste (CSV)")}</button>
      </div>

      <div className={cardClass("overflow-hidden")}>
        {filtered.length > 0 ? (
          filtered.slice(0, visible).map((attendee) => <AttendeeRow key={attendee.id} attendee={attendee} />)
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="text-sm text-ink-5">{t("Aucun participant ne correspond à ces critères.")}</p>
            <button type="button" onClick={reset} className="text-sm font-medium text-link hover:text-link-hover">{t("Réinitialiser")}</button>
          </div>
        )}
      </div>

      {filtered.length > visible ? (
        <LoadMoreButton onClick={() => setVisible((current) => current + PAGE_SIZE)} remaining={filtered.length - visible} />
      ) : null}
    </div>
  );
}
