import Link from "next/link";
import { EventCard } from "@/components/home/event-card";
import type { MockEvent } from "@/lib/mock/events";

export function FeaturedEvents({ events }: { events: MockEvent[] }) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">À la une — Paris</h2>
        <Link
          href="/catalogue"
          className="text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          Voir tout →
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun événement publié pour l&apos;instant.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}
