import type { Metadata } from "next";
import { SHARED_OPEN_GRAPH } from "@/lib/site-url";
import { notFound, permanentRedirect } from "next/navigation";
import { cache, type ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { EventHeader } from "@/components/event-detail/event-header";
import { fromPriceLabel } from "@/lib/format/price-label";
import { TicketSelector } from "@/components/event-detail/ticket-selector";
import { FeaturedEventCard } from "@/components/home/featured-event-card";
import { EventLocationMap } from "@/components/map/event-location-map";
import { getEvent, getEventBySlug, getEventCategories, listPublishedEvents, type ApiEvent } from "@/lib/api/events";
import { listCategories } from "@/lib/api/categories";
import {
  apiEventToDetail,
  apiEventToFeatured,
  type FeaturedEvent,
} from "@/lib/mappers/event-mappers";
import { ApiError } from "@/lib/api/http-error";
import type { Locale } from "@/lib/i18n/config";
import { dateFormat } from "@/lib/i18n/intl";
import { getLocale } from "@/lib/i18n/server";
import { translatorFor, type Translate } from "@/lib/i18n/translate";

/** Bandeau affiché quand l'événement n'est pas achetable (désactivé, annulé, terminé, non publié). */
function unavailability(
  tr: Translate,
  status: string,
  suspensionReason: string | null,
  cancellationReason: string | null,
  postponementReason: string | null,
): { title: string; message: string | null } | null {
  switch (status) {
    case "PUBLISHED":
      return null;
    case "POSTPONED":
      return {
        title: tr("Cet événement est reporté : la nouvelle date sera annoncée prochainement. Les billets déjà achetés restent valables."),
        message: postponementReason,
      };
    case "SUSPENDED":
      return { title: tr("Les ventes de cet événement sont momentanément suspendues."), message: suspensionReason };
    case "CANCELLED":
      return {
        title: tr("Cet événement est annulé. Les acheteurs sont remboursés automatiquement."),
        message: cancellationReason,
      };
    case "TERMINATED":
    case "ARCHIVED":
      return { title: tr("Cet événement est terminé."), message: null };
    default:
      return { title: tr("Cet événement n'est pas encore en vente."), message: null };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Événement par adresse lisible ou identifiant ; cache partagé avec les métadonnées ; null si introuvable. */
const loadEvent = cache(async (param: string): Promise<ApiEvent | null> => {
  try {
    return UUID.test(param) ? await getEvent(param) : await getEventBySlug(param);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

/** Titre d'onglet et aperçu de partage (réseaux sociaux, messageries). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await loadEvent(id).catch(() => null);
  const tr = translatorFor(await getLocale());
  if (!event) return { title: tr("Événement introuvable — BilleTix") };
  const description = event.description.replace(/\s+/g, " ").trim().slice(0, 160);
  // Adresse de référence : le lien lisible (slug), quel que soit le lien utilisé.
  const path = `/evenements/${event.slug ?? event.id}`;
  return {
    title: `${event.title} — BilleTix`,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      title: event.title,
      description,
      url: path,
      images: event.poster_url ? [{ url: event.poster_url }] : undefined,
    },
  };
}

// Nombre de suggestions sous la fiche (réglage d'affichage).
const SUGGESTIONS_LIMIT = 3;

/** Autres événements publiés (jamais celui affiché) — la fiche reste utilisable si ça échoue. */
async function loadSuggestions(currentId: string, locale: Locale): Promise<FeaturedEvent[]> {
  try {
    const [{ data }, referential] = await Promise.all([listPublishedEvents({}), listCategories().catch(() => [])]);
    return await Promise.all(
      data
        .filter((e) => e.id !== currentId)
        .slice(0, SUGGESTIONS_LIMIT)
        .map(async (e) => apiEventToFeatured(e, await getEventCategories(e.id).catch(() => []), referential, locale)),
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
  const { id: param } = await params;
  const locale = await getLocale();
  const tr = translatorFor(locale);

  const apiEvent = await loadEvent(param);
  if (!apiEvent) notFound();
  // Ancienne adresse par identifiant : redirection permanente vers
  // l'adresse lisible (les liens déjà partagés continuent de fonctionner).
  if (apiEvent.slug && param !== apiEvent.slug) permanentRedirect(`/evenements/${apiEvent.slug}`);
  const id = apiEvent.id;

  let event;
  let organizerId: string;
  let availability: { title: string; message: string | null } | null = null;
  // Report à une nouvelle date connue : rappel de la date d'origine.
  let postponedNote: string | null = null;
  try {
    const [categories, referential] = await Promise.all([
      getEventCategories(id),
      // Libellé de la catégorie tel que défini par l'administration.
      listCategories().catch(() => []),
    ]);
    event = apiEventToDetail(apiEvent, categories, referential, locale);
    organizerId = apiEvent.organizer_id;
    availability = unavailability(
      tr,
      apiEvent.status,
      apiEvent.suspension_reason,
      apiEvent.cancellation_reason,
      apiEvent.postponement_reason ?? null,
    );
    if (apiEvent.postponed_at && apiEvent.original_start_date) {
      const originally = dateFormat(
        { dateStyle: "full", timeZone: apiEvent.timezone || "Europe/Paris" },
        locale,
      ).format(new Date(apiEvent.original_start_date));
      if (apiEvent.status === "POSTPONED") {
        // Date d'origine caduque : pas de calendrier tant que la nouvelle n'est pas fixée.
        event = { ...event, calendar: undefined, dateRangeLabel: tr("Nouvelle date à venir"), timeRangeLabel: tr("Initialement prévu le {originally}", { originally }) };
      } else {
        postponedNote = tr("Événement reporté : initialement prévu le {originally}. Les billets déjà achetés restent valables pour la nouvelle date.", { originally });
      }
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const suggestions = await loadSuggestions(id, locale);
  const purchasable = availability === null;
  const price = fromPriceLabel(event.fromPrice, locale);
  const showMobileBar = purchasable && event.tickets.some((t) => t.remaining !== 0);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar active="/evenements" />

      <main className={`flex-1 ${showMobileBar ? "pb-24 md:pb-0" : ""}`}>
        <EventHeader event={event} purchasable={purchasable} />

        {postponedNote ? (
          <div className="mx-auto max-w-6xl px-6 pt-6">
            <div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
              <p className="text-sm font-semibold text-ink-1">{postponedNote}</p>
            </div>
          </div>
        ) : null}

        {availability ? (
          <div className="mx-auto max-w-6xl px-6 pt-6">
            <div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
              <p className="text-sm font-semibold text-ink-1">{availability.title}</p>
              {availability.message ? <p className="mt-1 text-sm text-ink-3">{availability.message}</p> : null}
            </div>
          </div>
        ) : null}

        {/* Deux colonnes dès md (détails 2/3, billets 1/3), une seule en dessous. */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 px-6 py-8 md:grid-cols-3">
          <section className="rounded-2xl border border-hairline-2 bg-card p-6 shadow-sm md:col-span-2 md:p-8">
            <h2 className="flex items-center gap-3 text-xl font-bold text-ink-1">
              <span aria-hidden="true" className="h-6 w-1 rounded-full bg-brand" />{tr("À propos de l'événement")}</h2>
            <p className="mt-5 whitespace-pre-line text-[15px] leading-7 text-ink-3">
              {event.description}
            </p>
            {event.lineup ? (
              <p className="mt-3 text-sm text-ink-3">{tr("Line-up : {lineup}", { lineup: event.lineup })}</p>
            ) : null}

            <SubSection title={tr("Lieu & accès")}>
              <p className="mb-3 text-sm text-ink-4">{event.address}</p>
              <EventLocationMap
                latitude={event.latitude}
                longitude={event.longitude}
                label={event.venueName}
              />
            </SubSection>

            <SubSection title={tr("Conditions d'accès")}>
              <p className="text-sm text-ink-4">{event.accessConditions}</p>
            </SubSection>
          </section>

          <div id="billets" className="scroll-mt-24 md:col-span-1">
            {availability ? (
              <div className="rounded-2xl border border-hairline-2 bg-card p-5 text-sm text-ink-4">
                <p className="font-semibold text-ink-2">{event.dateRangeLabel}</p>
                <p className="mt-1">{event.timeRangeLabel}</p>
                <p className="mt-4">{tr("La billetterie n'est pas disponible pour le moment.")}</p>
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
                    {event.fromPrice === 0 ? price : tr("À partir de {price}", { price })}
                  </p>
                ) : null}
              </div>
              <a
                href="#billets"
                className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30"
              >{tr("Réserver")}</a>
            </div>
          </div>
        ) : null}

        {suggestions.length > 0 ? (
          <section className="mx-auto max-w-6xl px-6 pb-16 pt-4">
            <h2 className="mb-5 text-2xl font-bold text-ink-1">{tr("Découvrez plus d'événements")}</h2>
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
