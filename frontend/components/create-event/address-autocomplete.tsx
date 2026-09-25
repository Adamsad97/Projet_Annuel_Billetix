"use client";

// Bug corrigé (attente utilisateur non couverte) : le champ Adresse était un
// simple <input> — tapé au clavier, sans aucune proposition. Ce que
// l'utilisateur voyait comme "propositions" en tapant était en réalité
// l'autocomplétion native du navigateur (autofill), sans rapport avec
// l'application ni avec les coordonnées GPS nécessaires à la carte.
// `autoComplete="off"` ci-dessous désactive cette autocomplétion navigateur
// pour ne laisser que la nôtre.

import { useEffect, useRef, useState } from "react";
import { resolveCountryBias, searchAddress, type AddressSuggestion } from "@/lib/geo/photon";

const fieldClassName =
  "rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function AddressAutocomplete({
  value,
  onChangeText,
  onSelect,
  // Valeur actuelle du champ "Pays" du formulaire — biaise la recherche
  // vers ce pays plutôt que de rester figé sur la France (plateforme
  // censée rester accessible à l'international, cf. lib/geo/photon.ts
  // resolveCountryBias).
  country,
  disabled = false,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  country: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    // Attend une pause de frappe avant d'interroger le service — même
    // logique que le catalogue (catalogue-explorer.tsx).
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const bias = await resolveCountryBias(country);
        if (cancelled) return;
        const results = await searchAddress(value, bias);
        if (!cancelled) setSuggestions(results);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [value, country]);

  return (
    <div className="relative">
      <input
        type="text"
        required
        disabled={disabled}
        value={value}
        onChange={(event) => {
          onChangeText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Laisse le temps au clic sur une suggestion de se déclencher
          // avant de refermer la liste — sinon onBlur ferme le menu avant
          // que onMouseDown sur la suggestion n'ait pu s'exécuter.
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        className={fieldClassName}
        autoComplete="off"
      />

      {open && (loading || suggestions.length > 0) ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#181523] shadow-xl">
          {loading ? (
            <li className="px-4 py-2.5 text-sm text-gray-500">Recherche…</li>
          ) : (
            suggestions.map((suggestion, index) => (
              <li key={`${suggestion.lat}-${suggestion.lng}-${index}`}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    // onMouseDown (avant le blur de l'input) plutôt que
                    // onClick, qui arriverait après la fermeture du menu.
                    event.preventDefault();
                    if (blurTimeout.current) clearTimeout(blurTimeout.current);
                    onSelect(suggestion);
                    setSuggestions([]);
                    setOpen(false);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-white/10"
                >
                  {suggestion.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
