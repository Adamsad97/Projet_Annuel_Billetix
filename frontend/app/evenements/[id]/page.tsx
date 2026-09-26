import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { EventHeader } from "@/components/event-detail/event-header";
import { TicketSelector } from "@/components/event-detail/ticket-selector";
import { FeaturedEventCard } from "@/components/home/featured-event-card";
import { EventLocationMap } from "@/components/map/event-location-map";
import { getEvent, getEventCategories, listPublishedEvents } from "@/lib/api/events";
import {
  apiEventToDetail,
  apiEventToFeatured,
  type FeaturedEvent,
} from "@/lib/mappers/event-mappers";
import { ApiError } from "@/lib/api/http-error";

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
  try {
    const [apiEvent, categories] = await Promise.all([
      getEvent(id),
      getEventCategories(id),
    ]);
    event = apiEventToDetail(apiEvent, categories);
    organizerId = apiEvent.organizer_id;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const suggestions = await loadSuggestions(id);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar active="/catalogue" />

      <main className="flex-1">
        <EventHeader event={event} />

        {/* Deux colonnes dès md (768px) : Détails à gauche (2/3), Date et
            billets à droite (1/3) — même disposition que la maquette. En
            dessous, une seule colonne dans l'ordre naturel. */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 px-6 py-8 md:grid-cols-3">
          <section className="rounded-2xl border border-hairline-2 bg-card p-5 md:col-span-2">
            <h2 className="mb-4 border-b border-hairline-2 pb-3 text-base font-bold text-ink-1">Détails</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-3">
              {event.description}
            </p>
            {event.lineup ? (
              <p className="mt-2 text-sm text-ink-3">Line-up : {event.lineup}</p>
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

          <div className="md:col-span-1">
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
          </div>
        </div>

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
    <div className="mt-5 border-t border-hairline-2 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-ink-1">{title}</h3>
      {children}
    </div>
  );
}
