"use client";

// Barre de recherche et de filtres des événements (recherche, ville,
// catégorie, date, prix, distance, tri), partagée par le catalogue et
// « À la une ». L'état vit dans useEventSearch.

import { useState } from "react";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";
import { filterSelectClass } from "@/components/ui/field";
import {
  RADIUS_OPTIONS_KM,
  SORT_OPTIONS,
  WHEN_OPTIONS,
  priceLabel,
  whenLabel,
  type CatalogueFilters,
} from "@/lib/catalogue/filters";
import type { EventSearch } from "@/lib/catalogue/use-event-search";

const fieldClassName =
  "h-11 w-full rounded-full border border-hairline-3 bg-card pl-11 pr-4 text-sm text-ink-1 placeholder:text-ink-5 focus:border-blue-500 focus:outline-none";
const smallInputClassName =
  "h-10 w-full rounded-xl border border-hairline-3 bg-page px-3 text-sm text-ink-1 focus:border-blue-500 focus:outline-none";
const applyButtonClassName =
  "h-10 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40";

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function EventFilterBar({ search }: { search: EventSearch }) {
  // Saisies des menus Date et Prix : appliquées au clic sur « Appliquer ».
  const [draftDates, setDraftDates] = useState({ from: "", to: "" });
  const [draftPrice, setDraftPrice] = useState({ min: "", max: "" });
  const categoryLabel =
    search.categories.find((c) => c.code === search.filters.category)?.label ?? search.filters.category;

  return (
    <div className="flex flex-col gap-6">
        {/* Recherche */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_280px]">
          <label className="relative">
            <span className="sr-only">Rechercher</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-5">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={search.filters.q}
              onChange={(event) => search.update({ q: event.target.value })}
              placeholder="Événement, artiste, lieu…"
              className={fieldClassName}
            />
          </label>
          <label className="relative">
            <span className="sr-only">Ville</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-5">
              <LocationPinIcon />
            </span>
            <input
              type="text"
              value={search.filters.city}
              onChange={(event) => search.update({ city: event.target.value })}
              placeholder="Ville"
              className={fieldClassName}
            />
          </label>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterMenu label="Catégorie" value={categoryLabel} active={search.filters.category !== ""}>
              {(close) => (
                <div role="menu">
                  <FilterOption selected={search.filters.category === ""} onSelect={() => { search.update({ category: "" }); close(); }}>
                    Toutes les catégories
                  </FilterOption>
                  {search.categories.map((category) => (
                    <FilterOption
                      key={category.id}
                      selected={search.filters.category === category.code}
                      onSelect={() => { search.update({ category: category.code }); close(); }}
                    >
                      {category.emoji ? `${category.emoji} ` : ""}
                      {category.label}
                    </FilterOption>
                  ))}
                </div>
              )}
            </FilterMenu>

            <FilterMenu label="Date" value={whenLabel(search.filters)} active={search.filters.when !== "all"}>
              {(close) => (
                <div role="menu">
                  {WHEN_OPTIONS.filter((option) => option.id !== "custom").map((option) => (
                    <FilterOption
                      key={option.id}
                      selected={search.filters.when === option.id}
                      onSelect={() => { search.update({ when: option.id, from: "", to: "" }); close(); }}
                    >
                      {option.label}
                    </FilterOption>
                  ))}
                  <div className="mt-2 border-t border-hairline-1 px-2 pb-1 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-5">Choisir des dates</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs text-ink-5">
                        Du
                        <input
                          type="date"
                          value={draftDates.from}
                          onChange={(event) => setDraftDates((d) => ({ ...d, from: event.target.value }))}
                          className={smallInputClassName}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-ink-5">
                        Au
                        <input
                          type="date"
                          value={draftDates.to}
                          min={draftDates.from || undefined}
                          onChange={(event) => setDraftDates((d) => ({ ...d, to: event.target.value }))}
                          className={smallInputClassName}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={!draftDates.from && !draftDates.to}
                      onClick={() => { search.update({ when: "custom", from: draftDates.from, to: draftDates.to }); close(); }}
                      className={`${applyButtonClassName} mt-3`}
                    >
                      Appliquer
                    </button>
                  </div>
                </div>
              )}
            </FilterMenu>

            <FilterMenu label="Prix" value={priceLabel(search.filters)} active={search.filters.price !== "all"}>
              {(close) => (
                <div role="menu">
                  <FilterOption selected={search.filters.price === "all"} onSelect={() => { search.update({ price: "all", minPrice: "", maxPrice: "" }); close(); }}>
                    Tous les prix
                  </FilterOption>
                  <FilterOption selected={search.filters.price === "free"} onSelect={() => { search.update({ price: "free", minPrice: "", maxPrice: "" }); close(); }}>
                    Gratuit
                  </FilterOption>
                  <div className="mt-2 border-t border-hairline-1 px-2 pb-1 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-5">Fourchette de prix (TTC)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs text-ink-5">
                        Minimum (€)
                        <input
                          inputMode="decimal"
                          value={draftPrice.min}
                          onChange={(event) => setDraftPrice((p) => ({ ...p, min: event.target.value }))}
                          placeholder="0"
                          className={smallInputClassName}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-ink-5">
                        Maximum (€)
                        <input
                          inputMode="decimal"
                          value={draftPrice.max}
                          onChange={(event) => setDraftPrice((p) => ({ ...p, max: event.target.value }))}
                          placeholder="100"
                          className={smallInputClassName}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={!draftPrice.min.trim() && !draftPrice.max.trim()}
                      onClick={() => { search.update({ price: "custom", minPrice: draftPrice.min, maxPrice: draftPrice.max }); close(); }}
                      className={`${applyButtonClassName} mt-3`}
                    >
                      Appliquer
                    </button>
                  </div>
                </div>
              )}
            </FilterMenu>

            <FilterMenu label="Distance" value={`À moins de ${search.radiusKm} km`} active={search.nearMe !== null}>
              {(close) => (
                <div className="flex flex-col gap-3 p-2">
                  <p className="text-sm text-ink-3">Événements autour de votre position actuelle.</p>
                  <label className="flex flex-col gap-1 text-xs text-ink-5">
                    Rayon
                    <select
                      value={search.radiusKm}
                      onChange={(event) => search.setRadiusKm(Number(event.target.value))}
                      className={smallInputClassName}
                    >
                      {RADIUS_OPTIONS_KM.map((km) => (
                        <option key={km} value={km}>
                          {km} km
                        </option>
                      ))}
                    </select>
                  </label>
                  {search.locateError ? <p className="text-xs text-danger">{search.locateError}</p> : null}
                  <div className="flex gap-2">
                    {search.nearMe ? (
                      <button
                        type="button"
                        onClick={() => { search.disableNearMe(); close(); }}
                        className="h-10 flex-1 rounded-xl border border-hairline-3 text-sm font-medium text-ink-2 hover:text-ink-1"
                      >
                        Désactiver
                      </button>
                    ) : null}
                    <button type="button" onClick={search.locate} disabled={search.locating} className={`${applyButtonClassName} flex-1`}>
                      {search.locating ? "Localisation…" : search.nearMe ? "Actualiser ma position" : "Utiliser ma position"}
                    </button>
                  </div>
                </div>
              )}
            </FilterMenu>

            {search.hasActiveFilters ? (
              <button
                type="button"
                onClick={search.resetAll}
                className="h-10 px-2 text-sm font-medium text-link transition-colors hover:text-link-hover"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-5">
            Trier par
            <select
              value={search.filters.sort}
              onChange={(event) => search.update({ sort: event.target.value as CatalogueFilters["sort"] })}
              className={filterSelectClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
    </div>
  );
}
