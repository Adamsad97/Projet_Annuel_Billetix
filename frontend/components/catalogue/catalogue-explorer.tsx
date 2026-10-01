"use client";

// Catalogue public : recherche, filtres et tri côté serveur, reflétés dans l'URL (partageable).

import { FeaturedEventCard } from "@/components/home/featured-event-card";
import { EventFilterBar } from "@/components/catalogue/event-filter-bar";
import { useEventSearch } from "@/lib/catalogue/use-event-search";
import { cardClass } from "@/components/ui/card";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { t } from "@/lib/i18n/translate";

export function CatalogueExplorer() {
  const search = useEventSearch({ syncUrl: true });
  const { events, total, loading, loadingMore, error, hasMore, loadMore, hasActiveFilters, resetAll } = search;

  return (
    <div className="flex flex-col gap-6">
      <EventFilterBar search={search} />

      {error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-danger">{error}</p>
      ) : null}

      {/* Résultats */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cardClass("h-96 animate-pulse")} />
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-5" role="status">{(total > 1 ? t("{total} événements", { total }) : t("{total} événement", { total }))}</p>

          {events.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <FeaturedEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className={cardClass("flex flex-col items-center gap-3 px-5 py-12 text-center")}>
              <p className="text-sm font-medium text-ink-2">
                {hasActiveFilters ? t("Aucun événement ne correspond à vos critères.") : t("Aucun événement à venir pour le moment.")}
              </p>
              {hasActiveFilters ? (
                <button type="button" onClick={resetAll} className="text-sm font-medium text-link hover:text-link-hover">{t("Effacer les filtres")}</button>
              ) : null}
            </div>
          )}

          {hasMore ? (
            <LoadMoreButton onClick={loadMore} loading={loadingMore} label={t("Afficher plus d'événements")} />
          ) : null}
        </>
      )}
    </div>
  );
}
