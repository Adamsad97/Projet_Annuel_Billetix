"use client";

// Bug corrigé : affichait les 5 billets de démonstration codés en dur, quel
// que soit le compte connecté — câblée sur order-service/ticket-service.

import { useEffect, useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { TicketRow } from "@/components/profile/ticket-row";
import { getMyOrders } from "@/lib/api/orders";
import { getTicketsByOrder } from "@/lib/api/tickets";
import { apiTicketToProfileTicket } from "@/lib/mappers/profile-mappers";
import type { ProfileTicket, TicketStatus } from "@/lib/mock/profile";

const filters = [
  { id: "all", label: "Tous" },
  { id: "valid", label: "Valides" },
  { id: "used", label: "Utilisés" },
];

export function TicketsExplorer() {
  const [status, setStatus] = useState("all");
  const [tickets, setTickets] = useState<ProfileTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const orders = await getMyOrders();
        const byOrder = await Promise.all(
          orders.map((order) => getTicketsByOrder(order.id).catch(() => [])),
        );
        if (cancelled) return;
        setTickets(byOrder.flat().map(apiTicketToProfileTicket));
      } catch {
        if (!cancelled) setError("Impossible de charger tes billets pour le moment.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!tickets) return [];
    if (status === "all") return tickets;
    return tickets.filter((ticket) => ticket.status === (status as TicketStatus));
  }, [status, tickets]);

  return (
    <div className="flex flex-col gap-5">
      <FilterPills options={filters} active={status} onChange={setStatus} />

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
        {tickets === null ? (
          <p className="px-5 py-4 text-sm text-gray-500">
            {error ?? "Chargement…"}
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">Aucun billet dans cette catégorie.</p>
        ) : (
          filtered.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
        )}
      </div>
    </div>
  );
}
