"use client";

// Pas de bouton « Acheter » sur sa propre annonce.

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApiResaleListing } from "@/lib/api/resale";
import { getStoredUser } from "@/lib/auth/session";
import { euros as currency } from "@/lib/format/money";
import { shortDate as dateFormatter } from "@/lib/format/dates";
import { cardClass } from "@/components/ui/card";

// Initiales seulement (comme la maquette d'origine : "L. T.") — le nom
// complet du vendeur n'a pas à être exposé publiquement sur la marketplace.
function sellerInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}. ${lastName.charAt(0)}.`;
}

export function ResaleCard({ listing }: { listing: ApiResaleListing }) {
  const [isOwnListing, setIsOwnListing] = useState(false);

  useEffect(() => {
    // localStorage absent côté serveur : lu après montage pour éviter un hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOwnListing(getStoredUser()?.id === listing.original_buyer_id);
  }, [listing.original_buyer_id]);

  return (
    <article className={cardClass("overflow-hidden")}>
      <div className="flex h-24 items-center justify-center bg-slate-800">
        <span className="text-3xl opacity-90">🎫</span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="font-bold text-ink-1">{listing.event_name}</h3>
          <p className="text-sm text-accent">{listing.category_name}</p>
          <p className="mt-0.5 text-sm text-ink-5">
            {dateFormatter.format(new Date(listing.event_start_at))} · {listing.event_venue_name}
            {listing.event_city ? `, ${listing.event_city}` : ""}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-hairline-1 pt-3">
          <div>
            <p className="text-xs text-ink-5">
              {isOwnListing ? "Votre annonce" : `Vendu par ${sellerInitials(listing.holder_first_name, listing.holder_last_name)}`}
            </p>
            <p className="font-bold text-ink-1">{currency.format(Number(listing.resale_price))}</p>
          </div>
          {isOwnListing ? (
            <Link
              href={`/billets/${listing.ticket_id}`}
              className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:border-hairline-5 hover:text-ink-1"
            >
              Gérer
            </Link>
          ) : (
            <Link
              href={`/revente/${listing.id}`}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Acheter
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
