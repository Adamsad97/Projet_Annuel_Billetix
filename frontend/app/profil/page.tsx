"use client";

// Bug corrigé : cette page affichait des billets/commandes 100% factices,
// quel que soit le compte connecté — câblée sur order-service/ticket-service.

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Panel } from "@/components/profile/panel";
import { TicketRow } from "@/components/profile/ticket-row";
import { OrderRow } from "@/components/profile/order-row";
import { SecurityPanel } from "@/components/profile/security-panel";
import { getMyOrdersSynced, type ApiOrder } from "@/lib/api/orders";
import { getMyTickets, getTicketsByOrder } from "@/lib/api/tickets";
import { apiOrderToProfileOrder, apiTicketToProfileTicket } from "@/lib/mappers/profile-mappers";
import type { ProfileOrder, ProfileTicket } from "@/lib/constants/profile";
import { getAccessToken, getStoredUser } from "@/lib/auth/session";
import { TwoFactorPromo } from "@/components/profile/two-factor-promo";
import { effectiveRole, isAdminRole } from "@/lib/auth/preview";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

// Nombre de commandes récentes prises en compte pour les deux panneaux
// (au-delà, "Tout voir →" mènera aux listes complètes une fois câblées).
const RECENT_ORDERS_LIMIT = 5;

export default function ProfilPage() {
  const [orders, setOrders] = useState<ProfileOrder[] | null>(null);
  const [tickets, setTickets] = useState<ProfileTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Un compte admin n'a ni billets ni commandes, sauf en mode aperçu acheteur.
  const [isAdmin, setIsAdmin] = useState(false);
  // Acheteur (vrai rôle, hors aperçu admin) : peut devenir organisateur.
  const [isBuyer, setIsBuyer] = useState(false);
  // Agent de contrôle : espace limité au contrôle et à son compte.
  const [isAgent, setIsAgent] = useState(false);

  useEffect(() => {
    const admin = isAdminRole(effectiveRole(getStoredUser()));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAdmin(admin);
    setIsBuyer(getStoredUser()?.role === "BUYER");
    const agent = getStoredUser()?.role === "AGENT";
    setIsAgent(agent);

    if (admin || agent || !getAccessToken()) {
      // Pas de session — évite un aller-retour réseau inutile pour rien.
      setOrders([]);
      setTickets([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const apiOrders: ApiOrder[] = await getMyOrdersSynced();
        const recent = [...apiOrders]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, RECENT_ORDERS_LIMIT);

        const [ticketsByOrder, mine] = await Promise.all([
          Promise.all(recent.map((order) => getTicketsByOrder(order.id).catch(() => []))),
          getMyTickets(),
        ]);

        if (cancelled) return;

        setOrders(
          recent.map((order, index) =>
            apiOrderToProfileOrder(order, ticketsByOrder[index].length),
          ),
        );
        setTickets(mine.tickets.map(apiTicketToProfileTicket).slice(0, 5));
      } catch {
        if (!cancelled) {
          setError(t("Impossible de charger vos commandes et billets pour le moment."));
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell width="4xl">
      <Link
        href={isAgent ? "/scan" : "/"}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
      >
        {isAgent ? t("← Contrôle des billets") : "← Accueil"}
      </Link>

      <ProfileHeader />
      <TwoFactorPromo className="mb-8" />

      {isAgent ? (
        <div className="mb-8 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-blue-700/40 to-transparent px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
                  <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
                </svg>
              </span>
              <div>
                <p className="text-base font-bold">{t("Espace agent de contrôle")}</p>
                <p className="text-sm text-white/70">{t("Vous contrôlez les billets des événements auxquels un organisateur vous a affecté.")}</p>
              </div>
            </div>
            <Link
              href="/scan"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
            >{t("Ouvrir le contrôle →")}</Link>
          </div>
        </div>
      ) : null}

      {isBuyer ? (
        <div className={cardClass("mb-8 flex flex-wrap items-center justify-between gap-4 px-5 py-4")}>
          <div>
            <p className="text-sm font-semibold text-ink-1">{t("Vous organisez des événements ?")}</p>
            <p className="mt-0.5 text-sm text-ink-5">{t("Vendez vos billets sur BilleTix, en gardant votre compte actuel.")}</p>
          </div>
          <Link
            href="/devenir-organisateur"
            className={buttonClass("secondary", "shrink-0 rounded-full px-4 py-2 text-sm")}
          >{t("Devenir organisateur →")}</Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {error ? (
          <Alert>
            {error}
          </Alert>
        ) : null}

        {isAdmin || isAgent ? null : (
          <>
            <Panel
              icon="🎫"
              title={t("Mes billets")}
              action={
                <Link
                  href="/profil/billets"
                  className="text-sm font-medium text-link transition-colors hover:text-link-hover"
                >{t("Tout voir →")}</Link>
              }
            >
              {tickets === null ? (
                <p className="px-5 py-4 text-sm text-ink-5">{t("Chargement…")}</p>
              ) : tickets.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-5">{t("Aucun billet pour l'instant.")}</p>
              ) : (
                tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
              )}
            </Panel>

            <Panel
              icon="📦"
              title={t("Mes commandes récentes")}
              action={
                <Link
                  href="/profil/commandes"
                  className="text-sm font-medium text-link transition-colors hover:text-link-hover"
                >{t("Tout voir →")}</Link>
              }
            >
              {orders === null ? (
                <p className="px-5 py-4 text-sm text-ink-5">{t("Chargement…")}</p>
              ) : orders.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-5">{t("Aucune commande pour l'instant.")}</p>
              ) : (
                orders.map((order) => <OrderRow key={order.reference} order={order} />)
              )}
            </Panel>
          </>
        )}

        <SecurityPanel />

        {/* Préférences d'emails d'achat : sans objet pour un agent de contrôle. */}
        {isAgent ? null : (
          <Link
            href="/profil/notifications"
            className={cardClass("flex items-center justify-between px-5 py-4 transition-colors hover:bg-hairline-1")}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-ink-2">{t("🔔 Préférences de notification")}</span>
            <span className="text-sm text-link">{t("Gérer →")}</span>
          </Link>
        )}
      </div>
    </PageShell>
  );
}
