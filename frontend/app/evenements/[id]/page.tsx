import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { EventHero } from "@/components/event-detail/event-hero";
import { InfoCard } from "@/components/event-detail/info-card";
import { TicketSelector } from "@/components/event-detail/ticket-selector";
import { getEvent, getEventCategories } from "@/lib/api/events";
import { apiEventToDetail } from "@/lib/mappers/event-mappers";
import { ApiError } from "@/lib/api/http-error";

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

  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <Navbar active="/catalogue" />

      <main className="flex-1">
        <EventHero event={event} />

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <InfoCard icon="ℹ️" title="Description">
              <p className="text-sm leading-relaxed text-violet-200/90">
                {event.description}
              </p>
              {event.lineup ? (
                <p className="mt-2 text-sm text-violet-200/90">
                  Line-up : {event.lineup}
                </p>
              ) : null}
            </InfoCard>

            <InfoCard icon="📍" title="Lieu & accès">
              <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
                <span className="text-sm text-gray-500">
                  🗺️ Carte interactive
                </span>
                <span className="text-sm text-gray-600">
                  {event.address}
                </span>
              </div>
            </InfoCard>

            <InfoCard
              icon="⚠️"
              title="Conditions d'accès"
              titleClassName="text-amber-300"
            >
              <p className="text-sm text-gray-400">
                {event.accessConditions}
              </p>
            </InfoCard>
          </div>

          <div className="lg:col-span-1">
            <TicketSelector eventId={id} eventTitle={event.title} tickets={event.tickets} organizerId={organizerId} />
          </div>
        </div>
      </main>
    </div>
  );
}
