"use client";

// Billets dont le compte est titulaire (achetés, reçus en cadeau, rachetés
// en revente) et historique des transferts (offerts, retirés) — GET /tickets/mine.

import { useEffect, useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { GivenTicketRow } from "@/components/profile/given-ticket-row";
import { TicketRow } from "@/components/profile/ticket-row";
import { ResoldTicketRow } from "@/components/profile/resold-ticket-row";
import { WithdrawnTicketRow } from "@/components/profile/withdrawn-ticket-row";
import { getMyTickets, type ApiGivenTicket, type ApiResoldTicket, type ApiWithdrawnTicket } from "@/lib/api/tickets";
import { apiTicketToProfileTicket } from "@/lib/mappers/profile-mappers";
import type { ProfileTicket, TicketStatus } from "@/lib/mock/profile";

const filters = [
  { id: "all", label: "Tous" },
  { id: "valid", label: "Valides" },
  { id: "used", label: "Utilisés" },
  { id: "given", label: "Transferts" },
  { id: "resold", label: "Revendus" },
];

export function TicketsExplorer() {
  const [status, setStatus] = useState("all");
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

  const filtered = useMemo(() => {
    if (!tickets || status === "given" || status === "resold") return [];
    if (status === "all") return tickets;
    return tickets.filter((ticket) => ticket.status === (status as TicketStatus));
  }, [status, tickets]);

  const showGiven = status === "given" || status === "all";
  const showResold = status === "resold" || status === "all";
  const isEmpty =
    filtered.length === 0 &&
    (!showGiven || given.length + withdrawn.length === 0) &&
    (!showResold || resold.length === 0);

  return (
    <div className="flex flex-col gap-5">
      <FilterPills options={filters} active={status} onChange={setStatus} />

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {tickets === null ? (
          <p className="px-5 py-4 text-sm text-ink-5">{error ?? "Chargement…"}</p>
        ) : isEmpty ? (
          <p className="px-5 py-4 text-sm text-ink-5">Aucun billet dans cette catégorie.</p>
        ) : (
          <>
            {filtered.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
            {showGiven
              ? given.map((item) => (
                  <GivenTicketRow key={item.id} given={item} onChanged={() => setVersion((current) => current + 1)} />
                ))
              : null}
            {showGiven ? withdrawn.map((item) => <WithdrawnTicketRow key={item.id} item={item} />) : null}
            {showResold ? resold.map((item) => <ResoldTicketRow key={item.id} item={item} />) : null}
          </>
        )}
      </div>
    </div>
  );
}
