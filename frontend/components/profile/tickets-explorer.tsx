"use client";

// Billets dont le compte est titulaire (achetés, reçus en cadeau, rachetés
// en revente) et historique des transferts (offerts, retirés) — GET /tickets/mine.

import { useEffect, useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchField } from "@/components/ui/search-field";
import { GivenTicketRow } from "@/components/profile/given-ticket-row";
import { TicketRow } from "@/components/profile/ticket-row";
import { ResoldTicketRow } from "@/components/profile/resold-ticket-row";
import { WithdrawnTicketRow } from "@/components/profile/withdrawn-ticket-row";
import { getMyTickets, type ApiGivenTicket, type ApiResoldTicket, type ApiWithdrawnTicket } from "@/lib/api/tickets";
import { matchesSearch } from "@/lib/format/search";
import { apiTicketToProfileTicket } from "@/lib/mappers/profile-mappers";
import type { ProfileTicket, TicketStatus } from "@/lib/constants/profile";

const filters = [
  { id: "all", label: "Tous" },
  { id: "valid", label: "Valides" },
  { id: "used", label: "Utilisés" },
  { id: "given", label: "Transferts" },
  { id: "resold", label: "Revendus" },
];

export function TicketsExplorer() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<ProfileTicket[] | null>(null);
  const [given, setGiven] = useState<ApiGivenTicket[]>([]);
  const [withdrawn, setWithdrawn] = useState<ApiWithdrawnTicket[]>([]);
  const [resold, setResold] = useState<ApiResoldTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMyTickets()
      .then((result) => {
        if (cancelled) return;
        setTickets(result.tickets.map(apiTicketToProfileTicket));
        setGiven(result.given);
        setWithdrawn(result.withdrawn ?? []);
        setResold(result.resold ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger vos billets pour le moment.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // Recherche par événement, lieu ou référence du billet.
  const searchedTickets = useMemo(
    () => (tickets ?? []).filter((ticket) => matchesSearch(search, ticket.title, ticket.venue)),
    [tickets, search],
  );
  const searchedGiven = given.filter((item) => matchesSearch(search, item.event_name, item.ticket_reference));
  const searchedWithdrawn = withdrawn.filter((item) => matchesSearch(search, item.event_name, item.ticket_reference));
  const searchedResold = resold.filter((item) => matchesSearch(search, item.event_name, item.ticket_reference));

  const filtered = useMemo(() => {
    if (status === "given" || status === "resold") return [];
    if (status === "all") return searchedTickets;
    return searchedTickets.filter((ticket) => ticket.status === (status as TicketStatus));
  }, [status, searchedTickets]);

  const showGiven = status === "given" || status === "all";
  const showResold = status === "resold" || status === "all";
  const isEmpty =
    filtered.length === 0 &&
    (!showGiven || searchedGiven.length + searchedWithdrawn.length === 0) &&
    (!showResold || searchedResold.length === 0);

  const byStatus = (value: TicketStatus) => searchedTickets.filter((ticket) => ticket.status === value).length;
  const filterOptions = filters.map((filter) => ({
    ...filter,
    count:
      filter.id === "all"
        ? searchedTickets.length + searchedGiven.length + searchedWithdrawn.length + searchedResold.length
        : filter.id === "given"
          ? searchedGiven.length + searchedWithdrawn.length
          : filter.id === "resold"
            ? searchedResold.length
            : byStatus(filter.id as TicketStatus),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills options={filterOptions} active={status} onChange={setStatus} />
        <SearchField value={search} onChange={setSearch} placeholder="Événement, lieu ou référence…" className="w-full sm:max-w-xs" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {tickets === null ? (
          <p className="px-5 py-4 text-sm text-ink-5">{error ?? "Chargement…"}</p>
        ) : isEmpty ? (
          <p className="px-5 py-4 text-sm text-ink-5">
            {search.trim() ? "Aucun billet ne correspond à votre recherche." : "Aucun billet dans cette catégorie."}
          </p>
        ) : (
          <>
            {filtered.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
            {showGiven
              ? searchedGiven.map((item) => (
                  <GivenTicketRow key={item.id} given={item} onChanged={() => setVersion((current) => current + 1)} />
                ))
              : null}
            {showGiven ? searchedWithdrawn.map((item) => <WithdrawnTicketRow key={item.id} item={item} />) : null}
            {showResold ? searchedResold.map((item) => <ResoldTicketRow key={item.id} item={item} />) : null}
          </>
        )}
      </div>
    </div>
  );
}
