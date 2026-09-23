"use client";

import { useState } from "react";
import { categoryFilters } from "@/lib/mock/events";

export function CategoryFilters() {
  const [active, setActive] = useState("Tous");

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {categoryFilters.map(({ label, emoji }) => {
        const isActive = label === active;
        return (
          <button
            key={label}
            type="button"
            onClick={() => setActive(label)}
            className={
              isActive
                ? "rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow shadow-violet-900/40"
                : "rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
            }
          >
            {emoji ? <span className="mr-1.5">{emoji}</span> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
