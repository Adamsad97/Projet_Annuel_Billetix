"use client";

// Recherche de la page d'accueil : ouvre le catalogue filtré (?q=…).

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const q = query.trim();
        router.push(q ? `/catalogue?q=${encodeURIComponent(q)}` : "/catalogue");
      }}
      className="mt-2 flex w-full max-w-2xl items-center gap-2 rounded-full bg-hairline-1 p-2 ring-1 ring-inset ring-hairline-2"
    >
      <label className="sr-only" htmlFor="home-search">
        Rechercher un événement
      </label>
      <input
        id="home-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Événement, artiste, lieu…"
        className="w-full bg-transparent px-4 py-2.5 text-sm text-ink-1 placeholder:text-ink-5 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow shadow-blue-900/40 transition-opacity hover:opacity-90"
      >
        Rechercher
      </button>
    </form>
  );
}
