"use client";

// Pastille du menu admin : nombre de demandes d'annulation en attente.

import { useEffect, useState } from "react";
import { getPendingCancellationCount } from "@/lib/api/cancellation";

export function PendingCancellationsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getPendingCancellationCount()
      .then((result) => setCount(result.count))
      .catch(() => setCount(0));
  }, []);

  if (count === 0) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
      {count}
    </span>
  );
}
