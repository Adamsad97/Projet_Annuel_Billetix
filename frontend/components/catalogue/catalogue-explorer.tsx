"use client";

import { useEffect, useState } from "react";
import { EventCard } from "@/components/home/event-card";
import { SearchInput } from "@/components/admin/search-input";
import { getEventCategories, listPublishedEvents } from "@/lib/api/events";
import { apiEventToCard } from "@/lib/mappers/event-mappers";
import { ApiError } from "@/lib/api/http-error";
import type { MockEvent } from "@/lib/mock/events";

const categories: { id: string; label: string; emoji?: string; apiCode?: string }[] = [
  { id: "all", label: "Tous" },
  { id: "Concert", label: "Concert", emoji: "🎵", apiCode: "CONCERT" },
  { id: "Festival", label: "Festival", emoji: "🎪", apiCode: "FESTIVAL" },
  { id: "Théâtre", label: "Théâtre", emoji: "🎭", apiCode: "THEATRE" },
  { id: "Sport", label: "Sport", emoji: "⚽", apiCode: "SPORT" },
  { id: "Conférence", label: "Conférence", emoji: "💡", apiCode: "CONFERENCE" },
  { id: "Danse", label: "Danse", emoji: "💃", apiCode: "DANSE" },
  { id: "gratuit", label: "Gratuit", emoji: "🎫" },
];

export function CatalogueExplorer() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [events, setEvents] = useState<MockEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const selected = categories.find((c) => c.id === category);

    // Attend une pause de frappe avant d'interroger le vrai backend.
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await listPublishedEvents({
          q: search.trim() || undefined,
          category: selected?.apiCode,
        });

        const withCategories = await Promise.all(
          data.map(async (event) => {
            const cats = await getEventCategories(event.id).catch(() => []);
            return apiEventToCard(event, cats);
          }),
        );

        if (cancelled) return;

        const filtered =
          category === "gratuit"
            ? withCategories.filter((e) => e.free)
            : withCategories;

        setEvents(filtered);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger le catalogue pour le moment.",
        );
        setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, category]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const isActive = cat.id === category;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={
                  isActive
                    ? "rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow shadow-violet-900/40"
                    : "rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
                }
              >
                {cat.emoji ? <span className="mr-1.5">{cat.emoji}</span> : null}
                {cat.label}
              </button>
            );
          })}
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un événement ou une ville…"
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement des événements…</p>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            {events?.length ?? 0} événement{(events?.length ?? 0) > 1 ? "s" : ""} trouvé
            {(events?.length ?? 0) > 1 ? "s" : ""}
          </p>

          {events && events.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-white/5 bg-[#12101c] px-5 py-10 text-center text-sm text-gray-500">
              Aucun événement ne correspond à cette recherche.
            </p>
          )}
        </>
      )}
    </div>
  );
}
