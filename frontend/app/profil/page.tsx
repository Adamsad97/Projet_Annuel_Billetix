"use client";

// Bug corrigé : cette page affichait des billets/commandes 100% factices,
// quel que soit le compte connecté — câblée sur order-service/ticket-service.

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthHeader } from "@/components/layout/auth-header";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Panel } from "@/components/profile/panel";
import { TicketRow } from "@/components/profile/ticket-row";
import { OrderRow } from "@/components/profile/order-row";
import { SecurityPanel } from "@/components/profile/security-panel";
import { getMyOrders, type ApiOrder } from "@/lib/api/orders";
import { getTicketsByOrder } from "@/lib/api/tickets";
import { apiOrderToProfileOrder, apiTicketToProfileTicket } from "@/lib/mappers/profile-mappers";
import type { ProfileOrder, ProfileTicket } from "@/lib/mock/profile";
import { getAccessToken, getStoredUser } from "@/lib/auth/session";

// Nombre de commandes récentes prises en compte pour les deux panneaux
// (au-delà, "Tout voir →" mènera aux listes complètes une fois câblées).
const RECENT_ORDERS_LIMIT = 5;

export default function ProfilPage() {
  const [orders, setOrders] = useState<ProfileOrder[] | null>(null);
  const [tickets, setTickets] = useState<ProfileTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Un compte ADMIN reste purement administratif — jamais aussi acheteur
  // (cf. Navbar : Catalogue/Revente déjà masqués pour ce rôle), donc ni
  // achats ni billets à afficher ici.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const admin = getStoredUser()?.role === "ADMIN";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAdmin(admin);

    if (admin || !getAccessToken()) {
      // Pas de session — évite un aller-retour réseau inutile pour rien.
      setOrders([]);
      setTickets([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const apiOrders: ApiOrder[] = await getMyOrders();
        const recent = [...apiOrders]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, RECENT_ORDERS_LIMIT);

        const ticketsByOrder = await Promise.all(
          recent.map((order) => getTicketsByOrder(order.id).catch(() => [])),
        );

        if (cancelled) return;

        setOrders(
          recent.map((order, index) =>
            apiOrderToProfileOrder(order, ticketsByOrder[index].length),
          ),
        );
        setTickets(ticketsByOrder.flat().map(apiTicketToProfileTicket).slice(0, 5));
      } catch {
        if (!cancelled) {
          setError("Impossible de charger tes commandes et billets pour le moment.");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Accueil
        </Link>

        <ProfileHeader />

        <div className="flex flex-col gap-6">
          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {isAdmin ? null : (
            <>
              <Panel
                icon="🎫"
                title="Mes billets"
                action={
                  <Link
                    href="/profil/billets"
                    className="text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
                  >
                    Tout voir →
                  </Link>
                }
              >
                {tickets === null ? (
                  <p className="px-5 py-4 text-sm text-gray-500">Chargement…</p>
                ) : tickets.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-500">Aucun billet pour l&apos;instant.</p>
                ) : (
                  tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
                )}
              </Panel>

              <Panel
                icon="📦"
                title="Mes commandes récentes"
                action={
                  <Link
                    href="/profil/commandes"
                    className="text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
                  >
                    Tout voir →
                  </Link>
                }
              >
                {orders === null ? (
                  <p className="px-5 py-4 text-sm text-gray-500">Chargement…</p>
                ) : orders.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-500">Aucune commande pour l&apos;instant.</p>
                ) : (
                  orders.map((order) => <OrderRow key={order.reference} order={order} />)
                )}
              </Panel>
            </>
          )}

          <SecurityPanel />

          <Link
            href="/profil/notifications"
            className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#12101c] px-5 py-4 transition-colors hover:bg-white/[0.03]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-200">
              🔔 Préférences de notification
            </span>
            <span className="text-sm text-violet-400">Gérer →</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
