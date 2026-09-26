"use client";

export function SearchBar() {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="mt-2 flex w-full max-w-2xl items-center gap-2 rounded-full bg-hairline-1 p-2 ring-1 ring-inset ring-hairline-2"
    >
      <input
        type="text"
        placeholder="Concert, festival, sport, conférence…"
        className="w-full bg-transparent px-4 py-2.5 text-sm text-ink-1 placeholder:text-ink-5 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow shadow-blue-900/40 transition-opacity hover:opacity-90"
      >
        Chercher
      </button>
    </form>
  );
}
