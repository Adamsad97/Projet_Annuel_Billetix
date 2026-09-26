"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { TicketOption } from "@/lib/mock/event-details";
import { reserveStock } from "@/lib/api/orders";
import { ApiError } from "@/lib/api/http-error";
import { saveCart } from "@/lib/checkout/cart";
import { getAccessToken, getStoredUser } from "@/lib/auth/session";
import { CountdownDigits } from "@/components/event-detail/sales-countdown";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";

const currency = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const saleDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

export function TicketSelector({
  eventId,
  eventTitle,
  tickets,
  organizerId,
  salesStartAt,
  salesEndAt,
  dateRangeLabel,
  timeRangeLabel,
  venueName,
}: {
  eventId: string;
  eventTitle: string;
  tickets: TicketOption[];
  organizerId: string;
  salesStartAt: string;
  salesEndAt: string;
  dateRangeLabel?: string;
  timeRangeLabel?: string;
  venueName: string;
}) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(tickets.map((t) => [t.id, t.defaultQuantity ?? 0])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bug corrigé : le backend refuse déjà qu'un organisateur achète un
  // billet pour son propre événement (order.service.ts create()), mais la
  // page publique proposait quand même le formulaire d'achat — l'erreur
  // n'arrivait qu'après réservation + saisie de facturation, beaucoup
  // trop tard. Lu en useEffect (comme partout ailleurs dans l'app) : le
  // compte connecté vit dans le localStorage, absent côté serveur.
  //
  // Bug corrigé (règle produit incomplète) : un compte ADMIN/SUPER_ADMIN
  // reste purement administratif, jamais acheteur (cf. commit 220f98e) —
  // ce gate ne couvrait que l'organisateur de CET événement, pas un admin
  // achetant sur l'événement de quelqu'un d'autre (bloqué côté backend
  // depuis order.controller.ts, mais l'erreur arrivait tout aussi tard).
  const [blockReason, setBlockReason] = useState<"own_event" | "admin" | null>(
    null,
  );

  useEffect(() => {
    const user = getStoredUser();
    if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlockReason("admin");
    } else if (user?.id === organizerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlockReason("own_event");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlockReason(null);
    }
  }, [organizerId]);

  // Bug corrigé : sales_start_date/sales_end_date étaient stockées mais
  // jamais vérifiées à l'achat, même une fois l'événement validé par un
  // admin — le backend refuse maintenant la réservation hors fenêtre
  // (ticket-category.service.ts decrementQuota()), mais l'erreur n'arrivait
  // qu'après avoir rempli le formulaire. "loading" le temps du useEffect,
  // pour éviter tout calcul de "maintenant" pendant le rendu serveur.
  const [salesState, setSalesState] = useState<"loading" | "not_open" | "open" | "closed">(
    "loading",
  );

  useEffect(() => {
    const now = Date.now();
    if (now < new Date(salesStartAt).getTime()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSalesState("not_open");
    } else if (now > new Date(salesEndAt).getTime()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSalesState("closed");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSalesState("open");
    }
  }, [salesStartAt, salesEndAt]);

  const total = useMemo(
    () =>
      tickets.reduce(
        (sum, ticket) => sum + ticket.price * (quantities[ticket.id] ?? 0),
        0,
      ),
    [tickets, quantities],
  );

  // Distinct de `total` : un événement gratuit a toujours total === 0 même
  // avec des billets sélectionnés — utiliser `total === 0` pour désactiver
  // le bouton (bug corrigé) rendait la réservation impossible pour tout
  // événement gratuit, quelle que soit la quantité choisie.
  const selectedCount = useMemo(
    () => Object.values(quantities).reduce((sum, qty) => sum + qty, 0),
    [quantities],
  );

  function updateQuantity(id: string, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  }

  async function handleReserve() {
    setError(null);

    if (!getAccessToken()) {
      router.push(`/connexion?next=/evenements/${eventId}`);
      return;
    }

    const items = tickets
      .filter((t) => (quantities[t.id] ?? 0) > 0)
      .map((t) => ({ ticket_category_id: t.id, quantity: quantities[t.id] }));

    if (items.length === 0) return;

    setLoading(true);
    try {
      const reservation = await reserveStock(eventId, items);
      saveCart({
        eventId,
        eventTitle,
        reservationToken: reservation.reservation_token,
        expiresAt: reservation.expires_at,
        lines: tickets
          .filter((t) => (quantities[t.id] ?? 0) > 0)
          .map((t) => ({
            ticketCategoryId: t.id,
            label: t.label,
            unitPrice: t.price,
            unitPriceHt: t.priceHt,
            quantity: quantities[t.id],
          })),
      });
      router.push("/commande");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Réservation impossible, veuillez réessayer.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Même cadre pour tous les états (achat, ventes pas encore ouvertes,
  // closes, compte admin/organisateur) : date, lieu, puis le contenu propre
  // à l'état, et le bouton « Partager » dessous.
  const shell = (content: ReactNode) => (
    <BookingShell dateRangeLabel={dateRangeLabel} timeRangeLabel={timeRangeLabel} venueName={venueName}>
      {content}
    </BookingShell>
  );

  if (blockReason === "admin") {
    return shell(
      <>
        <p className="text-sm text-ink-4">
          Un compte administrateur ne peut pas acheter de billets.
        </p>
        {/* Bug corrigé : l'organisateur/admin voyait uniquement le message
            de blocage, aucune info sur l'état des ventes de l'événement
            qu'il consulte — le tableau de compte à rebours n'apparaissait
            que côté acheteur. Repris ici en lecture seule (onZero: no-op,
            aucun formulaire d'achat à révéler pour ces rôles). */}
        {salesState === "not_open" ? (
          <div className="mt-4 border-t border-hairline-2 pt-4">
            <p className="mb-3 text-xs text-ink-5">Ouverture des ventes dans :</p>
            <CountdownDigits targetIso={salesStartAt} onZero={() => {}} />
          </div>
        ) : null}
        <Link
          href="/admin"
          className="mt-4 block rounded-full border border-hairline-3 px-4 py-2.5 text-center text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          Retour au back-office →
        </Link>
      </>,
    );
  }

  if (blockReason === "own_event") {
    return shell(
      <>
        <p className="text-sm text-ink-4">
          C&apos;est votre événement — un organisateur ne peut pas acheter de billet pour son propre
          événement.
        </p>
        {salesState === "not_open" ? (
          <div className="mt-4 border-t border-hairline-2 pt-4">
            <p className="mb-3 text-xs text-ink-5">Ouverture des ventes dans :</p>
            <CountdownDigits targetIso={salesStartAt} onZero={() => {}} />
          </div>
        ) : null}
        <Link
          href={`/dashboard/evenements/${eventId}`}
          className="mt-4 block rounded-full border border-hairline-3 px-4 py-2.5 text-center text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          Gérer cet événement →
        </Link>
      </>,
    );
  }

  if (salesState === "loading") {
    return shell(<p className="text-sm text-ink-5">Chargement…</p>);
  }

  // Bascule automatiquement sur le formulaire d'achat à zéro, sans recharger.
  if (salesState === "not_open") {
    return shell(
      <>
        <p className="text-sm text-ink-4">
          Les ventes ouvrent le {saleDateFormatter.format(new Date(salesStartAt))}
        </p>
        <div className="mt-4">
          <CountdownDigits targetIso={salesStartAt} onZero={() => setSalesState("open")} />
        </div>
        <p className="mt-3 text-center text-xs text-ink-5">
          La billetterie s&apos;ouvre automatiquement, pas besoin de recharger la page
        </p>
      </>,
    );
  }

  if (salesState === "closed") {
    return shell(
      <p className="text-sm text-ink-4">Les ventes pour cet événement sont closes.</p>,
    );
  }

  return shell(
    <>
      {tickets.length === 0 ? (
        <p className="text-sm text-ink-5">
          Aucune catégorie de billet disponible pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-hairline-1 p-3 ring-1 ring-inset ring-hairline-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold text-brand">
                    {ticket.label}
                  </span>
                  {ticket.tag ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
                      {ticket.tag}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  {ticket.originalPrice ? (
                    <span className="text-xs text-ink-5 line-through">
                      {ticket.originalPrice} €
                    </span>
                  ) : null}
                  <span className="text-sm font-bold text-ink-1">
                    {ticket.price === 0 ? "Gratuit" : currency.format(ticket.price)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateQuantity(ticket.id, -1)}
                  aria-label={`Retirer un billet ${ticket.label}`}
                  disabled={(quantities[ticket.id] ?? 0) === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-hairline-3 text-ink-1 transition-colors hover:bg-hairline-4 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-medium text-ink-1">
                  {quantities[ticket.id] ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(ticket.id, 1)}
                  aria-label={`Ajouter un billet ${ticket.label}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white transition-opacity hover:opacity-90"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm font-semibold text-ink-1">
        <span>
          {selectedCount} billet{selectedCount > 1 ? "s" : ""}
        </span>
        <span className="text-base font-bold">{currency.format(total)}</span>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-inset ring-red-500/30">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={selectedCount === 0 || loading}
        onClick={handleReserve}
        className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Réservation…" : "Réserver"}
      </button>

      <p className="mt-3 text-center text-xs text-ink-5">
        Prix TTC. Votre billet sera disponible dans votre espace BilleTix après le paiement.
      </p>
    </>,
  );
}

function BookingShell({
  dateRangeLabel,
  timeRangeLabel,
  venueName,
  children,
}: {
  dateRangeLabel?: string;
  timeRangeLabel?: string;
  venueName: string;
  children: ReactNode;
}) {
  return (
    <div className="sticky top-24 flex flex-col gap-3">
      <div className="rounded-2xl border border-hairline-2 bg-card p-5">
        <h2 className="border-b border-hairline-2 pb-3 text-base font-bold text-ink-1">
          Date et billets disponibles
        </h2>

        {dateRangeLabel ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand/5 p-3 ring-1 ring-inset ring-brand/25">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-brand">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 10h18" />
            </svg>
            <div className="text-sm leading-snug">
              <p className="font-semibold text-brand">{dateRangeLabel}</p>
              {timeRangeLabel ? <p className="text-ink-4">{timeRangeLabel}</p> : null}
            </div>
          </div>
        ) : null}

        <p className="mt-3 flex items-center gap-2 rounded-xl bg-brand/5 p-3 text-sm font-medium text-brand ring-1 ring-inset ring-brand/25">
          <LocationPinIcon />
          {venueName}
        </p>

        <div className="mt-4">{children}</div>
      </div>

      <ShareButton />
    </div>
  );
}

/** Partage natif (mobile) si disponible, sinon copie du lien. */
function ShareButton() {
  const [copied, setCopied] = useState(false);
  // Dernier recours si ni le partage natif ni le presse-papiers ne sont
  // disponibles : le lien s'affiche, sélectionnable (plus de window.prompt).
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
      } catch {
        // Partage annulé par l'utilisateur : rien à faire.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setManualUrl(url);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline-3 bg-card py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        {copied ? "Lien copié !" : "Partager"}
      </button>
      {manualUrl ? (
        <input
          readOnly
          autoFocus
          value={manualUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Lien de l'événement à copier"
          className="w-full rounded-xl border border-hairline-2 bg-hairline-1 px-3 py-2 text-xs text-ink-2"
        />
      ) : null}
    </>
  );
}
