import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { EventHeader, fromPriceLabel } from "@/components/event-detail/event-header";
import { TicketSelector } from "@/components/event-detail/ticket-selector";
import { FeaturedEventCard } from "@/components/home/featured-event-card";
import { EventLocationMap } from "@/components/map/event-location-map";
import { getEvent, getEventCategories, listPublishedEvents } from "@/lib/api/events";
import { listCategories } from "@/lib/api/categories";
import {
  apiEventToDetail,
  apiEventToFeatured,
  type FeaturedEvent,
} from "@/lib/mappers/event-mappers";
import { ApiError } from "@/lib/api/http-error";

/**
 * Événement non achetable : bandeau affiché au public (désactivé par
 * l'administration avec son message, annulé, terminé, pas encore publié).
 */
function unavailability(
  status: string,
  suspensionReason: string | null,
  cancellationReason: string | null,
): { title: string; message: string | null } | null {
  switch (status) {
    case "PUBLISHED":
      return null;
    case "SUSPENDED":
      return { title: "Les ventes de cet événement sont momentanément suspendues.", message: suspensionReason };
    case "CANCELLED":
      return {
        title: "Cet événement est annulé. Les acheteurs sont remboursés automatiquement.",
        message: cancellationReason,
      };
    case "TERMINATED":
    case "ARCHIVED":
      return { title: "Cet événement est terminé.", message: null };
    default:
      return { title: "Cet événement n'est pas encore en vente.", message: null };
  }
}

// Nombre de suggestions sous la fiche (réglage d'affichage).
const SUGGESTIONS_LIMIT = 3;

/** Autres événements publiés (jamais celui affiché) — la fiche reste utilisable si ça échoue. */
async function loadSuggestions(currentId: string): Promise<FeaturedEvent[]> {
  try {
    const { data } = await listPublishedEvents({});
    return await Promise.all(
      data
        .filter((e) => e.id !== currentId)
        .slice(0, SUGGESTIONS_LIMIT)
        .map(async (e) => apiEventToFeatured(e, await getEventCategories(e.id).catch(() => []))),
    );
  } catch {
    return [];
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let event;
  let organizerId: string;
  let availability: { title: string; message: string | null } | null = null;
  try {
    const [apiEvent, categories, referential] = await Promise.all([
      getEvent(id),
      getEventCategories(id),
      // Libellé de la catégorie tel que défini par l'administration.
      listCategories().catch(() => []),
    ]);
    event = apiEventToDetail(apiEvent, categories);
    const category = referential.find((c) => c.code === apiEvent.category);
    if (category) event = { ...event, categoryLabel: category.label };
    organizerId = apiEvent.organizer_id;
    availability = unavailability(apiEvent.status, apiEvent.suspension_reason, apiEvent.cancellation_reason);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const suggestions = await loadSuggestions(id);
  const purchasable = availability === null;
  const price = fromPriceLabel(event.fromPrice);
  const showMobileBar = purchasable && event.tickets.some((t) => t.remaining !== 0);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar active="/catalogue" />

      <main className={`flex-1 ${showMobileBar ? "pb-24 md:pb-0" : ""}`}>
        <EventHeader event={event} purchasable={purchasable} />

        {availability ? (
          <div className="mx-auto max-w-6xl px-6 pt-6">
            <div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
              <p className="text-sm font-semibold text-ink-1">{availability.title}</p>
              {availability.message ? <p className="mt-1 text-sm text-ink-3">{availability.message}</p> : null}
            </div>
          </div>
        ) : null}

        {/* Deux colonnes dès md (768px) : Détails à gauche (2/3), Date et
            billets à droite (1/3) — même disposition que la maquette. En
            dessous, une seule colonne dans l'ordre naturel. */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 px-6 py-8 md:grid-cols-3">
          <section className="rounded-2xl border border-hairline-2 bg-card p-6 shadow-sm md:col-span-2 md:p-8">
            <h2 className="flex items-center gap-3 text-xl font-bold text-ink-1">
              <span aria-hidden="true" className="h-6 w-1 rounded-full bg-brand" />
              À propos de l&apos;événement
            </h2>
            <p className="mt-5 whitespace-pre-line text-[15px] leading-7 text-ink-3">
              {event.description}
            </p>
            {event.lineup ? (
              <p className="mt-3 text-sm text-ink-3">Line-up : {event.lineup}</p>
            ) : null}

            <SubSection title="Lieu & accès">
              <p className="mb-3 text-sm text-ink-4">{event.address}</p>
              <EventLocationMap
                latitude={event.latitude}
                longitude={event.longitude}
                label={event.venueName}
              />
            </SubSection>

            <SubSection title="Conditions d'accès">
              <p className="text-sm text-ink-4">{event.accessConditions}</p>
            </SubSection>
          </section>

          <div id="billets" className="scroll-mt-24 md:col-span-1">
            {availability ? (
              <div className="rounded-2xl border border-hairline-2 bg-card p-5 text-sm text-ink-4">
                <p className="font-semibold text-ink-2">{event.dateRangeLabel}</p>
                <p className="mt-1">{event.timeRangeLabel}</p>
                <p className="mt-4">La billetterie n&apos;est pas disponible pour le moment.</p>
              </div>
            ) : (
              <TicketSelector
                eventId={id}
                eventTitle={event.title}
                tickets={event.tickets}
                organizerId={organizerId}
                salesStartAt={event.salesStartAt}
                salesEndAt={event.salesEndAt}
                dateRangeLabel={event.dateRangeLabel}
                timeRangeLabel={event.timeRangeLabel}
                venueName={event.venueName}
              />
            )}
          </div>
        </div>

        {showMobileBar ? (
          // Accès permanent à la billetterie sur mobile, où elle se trouve
          // sous la description.
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline-2 bg-card/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-1">{event.title}</p>
                {price ? (
                  <p className="text-xs text-ink-4">
                    {event.fromPrice === 0 ? price : `À partir de ${price}`}
                  </p>
                ) : null}
              </div>
              <a
                href="#billets"
                className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30"
              >
                Réserver
              </a>
            </div>
          </div>
        ) : null}

        {suggestions.length > 0 ? (
          <section className="mx-auto max-w-6xl px-6 pb-16 pt-4">
            <h2 className="mb-5 text-2xl font-bold text-ink-1">Découvrez plus d&apos;événements</h2>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <FeaturedEventCard event={suggestion} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}

/** Sous-partie de la carte « Détails », séparée par un filet. */
function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-8 border-t border-hairline-2 pt-6">
      <h3 className="mb-3 text-base font-semibold text-ink-1">{title}</h3>
      {children}
    </div>
  );
}
