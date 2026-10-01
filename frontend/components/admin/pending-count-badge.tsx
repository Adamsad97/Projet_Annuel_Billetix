"use client";

// Pastille du menu admin : nombre d'éléments en attente d'une décision
// (demandes d'annulation ou de report, vérifications d'identité, virements
// à émettre aux organisateurs payés par IBAN).

import { useEffect, useState } from "react";
import { getPayoutStats, getPendingKycCount } from "@/lib/api/admin";
import { getPendingCancellationCount } from "@/lib/api/cancellation";

const COUNTERS = {
  cancellations: getPendingCancellationCount,
  kyc: getPendingKycCount,
  payouts: () => getPayoutStats().then((stats) => ({ count: stats.to_transfer_count })),
} as const;

export type PendingCounter = keyof typeof COUNTERS;

export function PendingCountBadge({ counter }: { counter: PendingCounter }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    COUNTERS[counter]()
      .then((result) => setCount(result.count))
      .catch(() => setCount(0));
  }, [counter]);

  if (count === 0) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
      {count}
    </span>
  );
}
