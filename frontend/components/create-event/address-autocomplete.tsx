"use client";

// Bug corrigé (attente utilisateur non couverte) : le champ Adresse était un
// simple <input> — tapé au clavier, sans aucune proposition. Ce que
// l'utilisateur voyait comme "propositions" en tapant était en réalité
// l'autocomplétion native du navigateur (autofill), sans rapport avec
// l'application ni avec les coordonnées GPS nécessaires à la carte.
// `autoComplete="off"` ci-dessous désactive cette autocomplétion navigateur
// pour ne laisser que la nôtre.

import { useEffect, useRef, useState } from "react";
import { searchAddress, type AddressSuggestion } from "@/lib/geo/photon";

const fieldClassName =
  "rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function AddressAutocomplete({
  value,
  onChangeText,
  onSelect,
  // Valeur actuelle du champ "Pays" du formulaire — ses adresses passent en
  // tête des propositions, sans jamais exclure les autres pays (cf.
  // lib/geo/photon.ts searchAddress).
  country,
  disabled = false,
  placeholder,
  name,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  country: string;
  disabled?: boolean;
  placeholder?: string;
  /** Pour une lecture via FormData (formulaires de facturation). */
  name?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value.trim().length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    // Attend une pause de frappe avant d'interroger le service — même
    // logique que le catalogue (catalogue-explorer.tsx).
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchAddress(value, country);
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
        name={name}
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
        className={`w-full ${fieldClassName}`}
        autoComplete="off"
      />

      {open && (loading || suggestions.length > 0) ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-hairline-2 bg-popover shadow-xl">
          {loading ? (
            <li className="px-4 py-2.5 text-sm text-ink-5">Recherche…</li>
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
                  className="block w-full px-4 py-2.5 text-left text-sm text-ink-2 transition-colors hover:bg-hairline-2"
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
