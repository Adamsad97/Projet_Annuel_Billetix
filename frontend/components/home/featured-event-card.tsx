import Link from "next/link";
import type { ReactNode } from "react";
import { CountryFlag } from "@/components/home/country-flag";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";
import type { FeaturedEvent } from "@/lib/mappers/event-mappers";

/**
 * Carte du carrousel « À la une » : affiche en grand (fond flouté de la même
 * image pour combler les côtés, quel que soit son format), pastille
 * « validé », titre, lieu et pastilles date / pays / tarif / catégorie.
 */
export function FeaturedEventCard({ event }: { event: FeaturedEvent }) {
  return (
    <Link
      href={`/evenements/${event.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-hairline-2 bg-card transition-shadow hover:shadow-xl hover:shadow-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="relative aspect-[16/9.5] overflow-hidden">
        {event.posterUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO, fond décoratif flouté */}
            <img
              src={event.posterUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- affiche hébergée sur MinIO, hors domaines gérés par next/image */}
            <img
              src={event.posterUrl}
              alt={`Affiche : ${event.title}`}
              loading="lazy"
              className="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </>
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${event.band}`}>
            <span className="text-6xl opacity-90" aria-hidden="true">
              {event.categoryEmoji}
            </span>
          </div>
        )}

        {/* Seuls les événements validés par l'équipe sont publiés. */}
        <span
          title="Événement vérifié par BilleTix"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md ring-2 ring-white/80"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span className="sr-only">Événement vérifié</span>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="truncate text-xl font-bold text-ink-1" title={event.title}>
          {event.title}
        </h3>

        <p className="flex items-center gap-2 truncate text-sm font-medium text-brand">
          <LocationPinIcon size={18} />
          <span className="truncate">{event.venueName}</span>
        </p>

        <ul className="mt-1 flex flex-wrap gap-2">
          <Chip icon={<CalendarIcon />}>{event.dateLabel}</Chip>
          <Chip icon={<CountryFlag country={event.country} />}>{event.country}</Chip>
          {event.isFree !== null ? (
            <Chip icon={<TicketIcon />}>{event.isFree ? "Gratuit" : "Payant"}</Chip>
          ) : null}
          <Chip icon={<FolderIcon />}>{event.categoryLabel}</Chip>
        </ul>
      </div>
    </Link>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-2 rounded-full border border-hairline-3 px-3 py-1.5 text-sm text-ink-3">
      <span className="flex shrink-0 text-ink-4">{icon}</span>
      {children}
    </li>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4Z" />
      <path d="M14 6v12" strokeDasharray="2 2" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}
