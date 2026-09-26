"use client";

import { useState } from "react";
import { categoryFilters } from "@/lib/mock/events";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";

export function CategoryFilters() {
  const [active, setActive] = useState("Tous");

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {categoryFilters.map(({ label, emoji, icon }) => {
        const isActive = label === active;
        return (
          <button
            key={label}
            type="button"
            onClick={() => setActive(label)}
            className={
              isActive
                ? "rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow shadow-blue-900/40"
                : "rounded-full bg-hairline-1 px-4 py-2 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 hover:text-ink-1"
            }
          >
            {icon === "location" ? (
              <LocationPinIcon className="-mt-0.5 mr-1.5 inline" />
            ) : emoji ? (
              <span className="mr-1.5">{emoji}</span>
            ) : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
