"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchField } from "@/components/ui/search-field";
import { OrderRow } from "@/components/profile/order-row";
import { getMyOrdersSynced, type ApiOrder } from "@/lib/api/orders";
import { getTicketsByOrder } from "@/lib/api/tickets";
import { matchesSearch } from "@/lib/format/search";
import { apiOrderToProfileOrder } from "@/lib/mappers/profile-mappers";
import type { ProfileOrder, OrderStatus } from "@/lib/constants/profile";
import { cardClass } from "@/components/ui/card";

const filters: { id: string; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "sent", label: "Payées" },
  { id: "pending", label: "En attente" },
  { id: "cancelled", label: "Annulées/remboursées" },
];

function matchesFilter(status: OrderStatus, filterId: string): boolean {
  if (filterId === "all") return true;
  if (filterId === "cancelled") return status === "cancelled" || status === "refunded";
  return status === filterId;
}

export function OrdersExplorer() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<ProfileOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const apiOrders: ApiOrder[] = await getMyOrdersSynced();
        const sorted = [...apiOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const ticketCounts = await Promise.all(
          sorted.map((order) => getTicketsByOrder(order.id).catch(() => [])),
        );
        if (cancelled) return;
        setOrders(sorted.map((order, index) => apiOrderToProfileOrder(order, ticketCounts[index].length)));
      } catch {
        if (!cancelled) setError("Impossible de charger vos commandes pour le moment.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Recherche par référence de commande ou nom de l'événement.
  const searched = useMemo(
    () => (orders ?? []).filter((order) => matchesSearch(search, order.reference, order.eventName)),
    [orders, search],
  );

  const filtered = useMemo(
    () => searched.filter((order) => matchesFilter(order.status, status)),
    [status, searched],
  );

  const filterOptions = filters.map((filter) => ({
    ...filter,
    count: searched.filter((order) => matchesFilter(order.status, filter.id)).length,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills options={filterOptions} active={status} onChange={setStatus} />
        <SearchField value={search} onChange={setSearch} placeholder="Référence ou événement…" className="w-full sm:max-w-xs" />
      </div>

      <div className={cardClass("overflow-hidden")}>
        {orders === null ? (
          <p className="px-5 py-4 text-sm text-ink-5">{error ?? "Chargement…"}</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-5">
            {search.trim() ? "Aucune commande ne correspond à votre recherche." : "Aucune commande dans cette catégorie."}
          </p>
        ) : (
          filtered.map((order) => <OrderRow key={order.reference} order={order} />)
        )}
      </div>
    </div>
  );
}
