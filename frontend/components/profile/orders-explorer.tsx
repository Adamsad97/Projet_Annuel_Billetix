"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { OrderRow } from "@/components/profile/order-row";
import { getMyOrdersSynced, type ApiOrder } from "@/lib/api/orders";
import { getTicketsByOrder } from "@/lib/api/tickets";
import { apiOrderToProfileOrder } from "@/lib/mappers/profile-mappers";
import type { ProfileOrder, OrderStatus } from "@/lib/mock/profile";

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
        if (!cancelled) setError("Impossible de charger tes commandes pour le moment.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => matchesFilter(order.status, status));
  }, [status, orders]);

  return (
    <div className="flex flex-col gap-5">
      <FilterPills options={filters} active={status} onChange={setStatus} />

      <div className="overflow-hidden rounded-2xl border border-hairline-1 bg-card">
        {orders === null ? (
          <p className="px-5 py-4 text-sm text-ink-5">{error ?? "Chargement…"}</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-5">Aucune commande dans cette catégorie.</p>
        ) : (
          filtered.map((order) => <OrderRow key={order.reference} order={order} />)
        )}
      </div>
    </div>
  );
}
